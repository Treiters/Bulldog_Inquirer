// This file runs on Netlify's servers (NOT in the browser)
// Your Firebase keys are safe here

const admin = require('firebase-admin');

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
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const app = getFirebaseApp();
    const db = admin.firestore(app);
    const storage = admin.storage(app);
    
    const body = event.body ? JSON.parse(event.body) : {};
    const { action, data } = body;

    // ARTICLE OPERATIONS
    if (action === 'getArticles') {
      const snapshot = await db.collection('articles')
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
    }

    if (action === 'addArticle') {
      // Verify user is authenticated (you'll pass a token from client)
      if (!data.userToken) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ success: false, error: 'Unauthorized' })
        };
      }

      // Add article to Firestore (including PDF URL)
      const docRef = await db.collection('articles').add({
        title: data.article.title,
        category: data.article.category,
        author: data.article.author || data.article.authorName,
        authorName: data.article.authorName,
        authorUid: data.article.authorUid,
        date: data.article.date,
        excerpt: data.article.excerpt,
        content: data.article.content || '',
        featured: data.article.featured || false,
        pdfUrl: data.article.pdfUrl || null,
        pdfFileName: data.article.pdfFileName || null,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, id: docRef.id })
      };
    }

    if (action === 'deleteArticle') {
      if (!data.userToken || !data.articleId) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ success: false, error: 'Unauthorized' })
        };
      }

      await db.collection('articles').doc(data.articleId).delete();

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true })
      };
    }

    // AUTHENTICATION
    if (action === 'login') {
      const auth = admin.auth(app);
      
      try {
        // Verify user exists
        const userRecord = await auth.getUserByEmail(data.email);
        
        // Create custom token
        const token = await auth.createCustomToken(userRecord.uid);
        
        // Get user data from Firestore
        const userDoc = await db.collection('users')
          .where('uid', '==', userRecord.uid)
          .get();
        
        let userData = null;
        if (!userDoc.empty) {
          userData = userDoc.docs[0].data();
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ 
            success: true, 
            token,
            user: userData
          })
        };
      } catch (error) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ success: false, error: 'Invalid credentials' })
        };
      }
    }

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: 'Unknown action' })
    };

  } catch (error) {
    console.error('Firebase API Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};