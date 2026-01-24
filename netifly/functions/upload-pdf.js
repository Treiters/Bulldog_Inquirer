// netlify/functions/upload-pdf.js
const admin = require('firebase-admin');
const busboy = require('busboy');

// Initialize Firebase Admin SDK (only once)
function getFirebaseApp() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      }),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET
    });
  }
  return admin.app();
}

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const app = getFirebaseApp();
    const bucket = admin.storage().bucket();
    
    const result = await parseMultipartForm(event);
    
    if (!result.file) {
      throw new Error('No file uploaded');
    }

    // Generate unique filename
    const timestamp = Date.now();
    const fileName = `articles/${timestamp}-${result.fileName}`;

    // Upload to Firebase Storage
    const file = bucket.file(fileName);
    
    await file.save(result.fileData, {
      metadata: {
        contentType: 'application/pdf'
      }
    });

    // Make the file publicly accessible
    await file.makePublic();

    // Get the public URL
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        url: publicUrl,
        fileName: result.fileName
      })
    };
  } catch (error) {
    console.error('Upload error:', error);
    return {
      statusCode: 500,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};

function parseMultipartForm(event) {
  return new Promise((resolve, reject) => {
    const bb = busboy({
      headers: {
        ...event.headers,
        'content-type': event.headers['content-type'] || event.headers['Content-Type']
      }
    });

    let result = {
      file: false,
      fileData: null,
      fileName: ''
    };

    bb.on('file', (fieldname, file, info) => {
      const { filename, mimeType } = info;
      
      if (mimeType !== 'application/pdf') {
        file.resume();
        return reject(new Error('Only PDF files are allowed'));
      }

      result.fileName = filename;
      const chunks = [];

      file.on('data', (data) => {
        chunks.push(data);
      });

      file.on('end', () => {
        result.fileData = Buffer.concat(chunks);
        result.file = true;
      });
    });

    bb.on('finish', () => {
      resolve(result);
    });

    bb.on('error', (error) => {
      reject(error);
    });

    bb.write(event.body, event.isBase64Encoded ? 'base64' : 'binary');
    bb.end();
  });
}