const functions = require('firebase-functions');
const app = require('express')();
const FBAuth = require('./util/fbAuth');
const {db} = require('./util/admin');


const {
    getAllScreams, 
    postOneScream, 
    getScream,
    commentOnScream,
    likeScream,
    unlikeScream,
    deleteScream
    
} = require('./handlers/screams');

const {
    signup,
    login,
    uploadImage, 
    addUserDetails,
    getAuthenticatedUser,
    getUserDetails,
    markNotificationsRead
} = require('./handlers/users');


// Scream routes
app.get('/screams',getAllScreams); 
app.post('/scream', FBAuth, postOneScream);
app.get('/scream/:screamId', getScream);
app.delete('/scream/:screamId', FBAuth, deleteScream);
app.get('/scream/:screamId/like', FBAuth, likeScream);
app.get('/scream/:screamId/unlike', FBAuth, unlikeScream);
app.post('/scream/:screamId/comment', FBAuth, commentOnScream);


 // users route
app.post('/signup',signup);
app.post('/login',login);
app.post('/user/image', FBAuth , uploadImage);
app.post('/user', FBAuth, addUserDetails);
app.get('/user', FBAuth , getAuthenticatedUser);
app.get('/user/:handle', getUserDetails);
app.post('/notifications', FBAuth, markNotificationsRead);
 

exports.api = functions.region('us-central1').https.onRequest(app);

exports.createNotificationOnLike = functions.region('us-central1')
 .firestore.document('likes/{id}')
   .onCreate((snapshot) =>{
      return db.doc(`/screams/${snapshot.data().screamId}`).get()
         .then((doc) =>{
             if(doc.exists && doc.data().userHandle !== snapshot.data().userHandle){
                 return db.doc(`/notifications/${snapshot.id}`).set({
                     createdAt: new Date().toISOString(),
                     recipient: doc.data().userHandle,
                     sender: snapshot.data().userHandle,
                     type: 'like',
                     read: false,
                     screamId: doc.id

                 });
             }

         })
      
         .catch((err) =>
             console.error(err));
         
   });



exports.deleteNotificationOnUnlike = functions.region('us-central1')
   .firestore.document('likes/{id}')
   .onDelete((snapshot) =>{
      return db.doc(`/notifications/${snapshot.id}`)
       .delete()
       .catch((err) =>{
           console.error(err);
           return;
       });
   });

   
exports.createNotificationOnComment = functions.region('us-central1')
   .firestore.document('comments/{id}')
   .onCreate((snapshot) =>{
    return db.doc(`/screams/${snapshot.data().screamId}`)
    .get()
    .then((doc) =>{
        if(doc.exists && doc.data().userHandle !== snapshot.data().userHandle){
            return db.doc(`/notifications/${snapshot.id}`).set({
                createdAt: new Date().toISOString(),
                recipient: doc.data().userHandle,
                sender: snapshot.data().userHandle,
                type: 'comment',
                read: false,
                screamId: doc.id

            });
        }

    })
    .catch((err) =>{
        console.error(err);
        return;
         
    });

   });

//Database trigger to change userImage in all
//Scream documents associated with this user
exports.onUserImageChange = functions.region('us-central1').firestore.document('/users/{userId}')
    .onUpdate((change) => {
        //change object holds two properties i.e.
        //1) before it(snapshot) was edited and
        //2) after it was edited.
        console.log(change.before.data());
        console.log(change.after.data());
        //We want to change the userImage in
        //multiple documents of screams collection
        //so we can do a batch write.
        if(change.before.data().imageUrl !== change.after.data().imageUrl){
            console.log('image has changed');            
            const batch = db.batch();
            return db.collection('screams')
                //In each document of users collection
                //the 'userHandle' field of each document
                //of screams collection, is called 'handle'.
                .where('userHandle', '==', change.before.data().handle).get()
                .then((data) => {
                    data.forEach(document => {
                        const scream = db.doc(`/screams/${document.id}`);
                        batch.update(scream, {userImage: change.after.data().imageUrl});
                    });

                    return db.collection('screams')
                //In each document of users collection
                //the 'userHandle' field of each document
                //of screams collection, is called 'handle'.
                .where('userHandle', '==', change.before.data().handle).get()
                   // return batch.commit();


                })

                
        } else {
            //To avoid 'function returned undefined. expected Promise or Value'
            //error on firebase logs console.
            //This means that if the above imageURL if condition is not satisfied,
            //the error log will be still avoided in the firebase console.
            //This can happen when the user updates any other data such as bio, location, etc.
            return true;
        }
        

        
    });


//Database trigger to delete likes, comments and notifications
//associated with a Scream when that Scream is deleted.
exports.onScreamDelete = functions.region('us-central1').firestore.document('/screams/{screamId}')
 .onDelete((snapshot, context) => {
    //context object has the URL parameters
    const screamId = context.params.screamId;
    const batch = db.batch();
    return db.collection('comments').where('screamId', '==', screamId).get().then((data) => {
        data.forEach(document => {
            //Delete all comments posted on that Scream.
            batch.delete(db.doc(`/comments/${document.id}`));
        });
        //Return all likes posted on that Scream.
        //Deleting these likes will be handled in
        //the next 'then' block.
        return db.collection('likes').where('screamId', '==', screamId).get();
    }).then((data) => {
        data.forEach(document => {
            //Delete all likes posted on that Scream.
            batch.delete(db.doc(`/likes/${document.id}`));
        });
        //Return all notifications regarding that Scream.
        //Deleting those notifications will be handled in
        //the next 'then' block.
        return db.collection('notifications').where('screamId', '==', screamId).get();
    }).then((data) => {
        data.forEach(document => {
            batch.delete(db.doc(`/notifications/${document.id}`));
        });
        //Commit and return the batch commit after all the batch deletes.
        return batch.commit();
    }).catch((err) => {
        console.error(err);
    });
});

