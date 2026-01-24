// netlify/functions/firebase-api.js
const admin = require('firebase-admin');

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
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const app = getFirebaseApp();
    const db = admin.firestore();
    const { action, data } = JSON.parse(event.body);

    switch (action) {
      case 'getArticles':
        return await getArticles(headers);
      
      case 'getUserData':
        return await getUserData(data, headers);
      
      case 'addArticle':
        return await addArticle(data, headers);
      
      case 'deleteArticle':
        return await deleteArticle(data, headers);
      
      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid action' })
        };
    }
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: error.message 
      })
    };
  }
};

async function getArticles(headers) {
  try {
    const snapshot = await admin.firestore().collection('articles')
      .orderBy('timestamp', 'desc')
      .get();
    
    const articles = [];
    snapshot.forEach(doc => {
      articles.push({ id: doc.id, ...doc.data() });
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, articles })
    };
  } catch (error) {
    throw new Error(`Failed to get articles: ${error.message}`);
  }
}

async function getUserData(data, headers) {
  try {
    const { uid, token } = data;

    // Verify the token
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    if (decodedToken.uid !== uid) {
      throw new Error('Unauthorized');
    }

    // Get user data from Firestore
    const userDoc = await admin.firestore().collection('users').doc(uid).get();
    
    if (!userDoc.exists) {
      throw new Error('User not found');
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        user: { uid, ...userDoc.data() }
      })
    };
  } catch (error) {
    throw new Error(`Failed to get user data: ${error.message}`);
  }
}

async function addArticle(data, headers) {
  try {
    const { userToken, article } = data;

    // Verify the token
    const decodedToken = await admin.auth().verifyIdToken(userToken);
    
    // Check if user has permission (you can add more checks here)
    const userDoc = await admin.firestore().collection('users').doc(decodedToken.uid).get();
    
    if (!userDoc.exists) {
      throw new Error('User not found');
    }

    const userData = userDoc.data();
    if (userData.role !== 'admin' && userData.role !== 'writer') {
      throw new Error('Unauthorized');
    }

    // Add the article
    const articleData = {
      ...article,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await admin.firestore().collection('articles').add(articleData);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        articleId: docRef.id 
      })
    };
  } catch (error) {
    throw new Error(`Failed to add article: ${error.message}`);
  }
}

async function deleteArticle(data, headers) {
  try {
    const { userToken, articleId } = data;

    // Verify the token
    const decodedToken = await admin.auth().verifyIdToken(userToken);
    
    // Check if user is admin
    const userDoc = await admin.firestore().collection('users').doc(decodedToken.uid).get();
    
    if (!userDoc.exists) {
      throw new Error('User not found');
    }

    const userData = userDoc.data();
    if (userData.role !== 'admin') {
      throw new Error('Only admins can delete articles');
    }

    // Delete the article
    await admin.firestore().collection('articles').doc(articleId).delete();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true })
    };
  } catch (error) {
    throw new Error(`Failed to delete article: ${error.message}`);
  }
}