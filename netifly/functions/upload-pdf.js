// This file handles PDF uploads to Firebase Storage securely

const admin = require('firebase-admin');
const busboy = require('busboy');

// Initialize Firebase Admin (only once)
let firebaseApp;

function getFirebaseApp() {
  if (!firebaseApp) {
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      }),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET
    });
  }
  return firebaseApp;
}

exports.handler = async (event, context) => {
  // Allow CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    const app = getFirebaseApp();
    const bucket = admin.storage(app).bucket();

    // Parse multipart form data
    return new Promise((resolve, reject) => {
      const bb = busboy({ headers: event.headers });
      let fileBuffer = null;
      let fileName = '';
      let mimeType = '';

      bb.on('file', (fieldname, file, info) => {
        const { filename, mimeType: mime } = info;
        fileName = filename;
        mimeType = mime;
        
        const chunks = [];
        
        file.on('data', (data) => {
          chunks.push(data);
        });
        
        file.on('end', () => {
          fileBuffer = Buffer.concat(chunks);
        });
      });

      bb.on('finish', async () => {
        if (!fileBuffer) {
          resolve({
            statusCode: 400,
            headers,
            body: JSON.stringify({ success: false, error: 'No file uploaded' })
          });
          return;
        }

        try {
          // Create unique filename
          const timestamp = Date.now();
          const uniqueFileName = `articles/${timestamp}-${fileName}`;

          // Upload to Firebase Storage
          const file = bucket.file(uniqueFileName);
          
          await file.save(fileBuffer, {
            metadata: {
              contentType: mimeType
            }
          });

          // Make the file publicly accessible
          await file.makePublic();

          // Get the public URL
          const publicUrl = `https://storage.googleapis.com/${bucket.name}/${uniqueFileName}`;

          resolve({
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              url: publicUrl,
              fileName: uniqueFileName
            })
          });
        } catch (error) {
          console.error('Upload error:', error);
          resolve({
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error.message })
          });
        }
      });

      bb.on('error', (error) => {
        console.error('Busboy error:', error);
        resolve({
          statusCode: 500,
          headers,
          body: JSON.stringify({ success: false, error: error.message })
        });
      });

      // Parse the event body
      bb.end(Buffer.from(event.body, 'base64'));
    });

  } catch (error) {
    console.error('PDF Upload Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};