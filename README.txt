OPM HUB — FIREBASE VERSION
==========================

This project uses:
- HTML, CSS, JavaScript
- Firebase Authentication (email/password admin sign-in)
- Cloud Firestore (catalog metadata)
- Cloudinary free media hosting (audio and cover images)
- Firebase Storage is NOT used by this version

IMPORTANT
---------
The Firebase config in app.js is a placeholder. You must connect your own Firebase project.
Do not put service-account keys or private server credentials in browser JavaScript.
The Firebase web config is intended to be used by client apps; Security Rules protect the data.

SETUP STEP 1 — CREATE PROJECT
1. Go to https://console.firebase.google.com/ and create a Firebase project.
2. In Project Overview, click the Web icon (</>) to register a web app named OPM HUB.
3. Copy the firebaseConfig object Firebase gives you.
4. Open app.js and replace every PASTE_... placeholder in firebaseConfig with your real values.

SETUP STEP 2 — ENABLE AUTHENTICATION
1. Firebase Console > Build > Authentication > Get started.
2. Sign-in method > Email/Password > Enable > Save.
3. Open Users > Add user, and create your own admin email/password.
4. Copy the admin user's UID from the Users page.

SETUP STEP 3 — CREATE FIRESTORE
1. Firebase Console > Build > Firestore Database > Create database.
2. Choose a location carefully; the database location cannot easily be changed later.
3. Create database. You can start in production mode.
4. Open the Rules tab and paste the content of firestore.rules, then Publish.
5. In the Data tab, create a collection named `admins`.
6. Create a document whose document ID is EXACTLY the admin user's Authentication UID.
   Add a field: `role` (string) = `admin`.
   This document is the allowlist checked by the rules. Do not create it for ordinary users.

SETUP STEP 4 — SET UP FREE MEDIA HOSTING (CLOUDINARY)
1. Go to https://cloudinary.com/users/register/free and create a free account.
2. In the Cloudinary Console, copy your Cloud Name.
3. Go to Settings > Upload, then create an upload preset.
4. Set the preset signing mode to Unsigned. Restrict allowed formats to the image formats you need and audio formats (for audio, Cloudinary uses its "video" resource type). Set reasonable file-size limits if the console offers them.
5. Copy the preset name.
6. In app.js, fill in cloudinaryConfig.cloudName and cloudinaryConfig.uploadPreset.
7. Do NOT put a Cloudinary API secret in app.js. An unsigned preset can be abused if exposed, so restrict formats/size and monitor usage. For a public production site, use a trusted server-side signed-upload endpoint.
8. You do not need to create a Firebase Storage bucket or publish storage.rules. Keep Firebase Authentication and Firestore enabled as described above.

SETUP STEP 5 — APPLY THE CONFIG
1. Replace firebaseConfig in app.js with the exact object from your Firebase web app.
2. Save app.js.
3. Serve the files over HTTP rather than opening the HTML file directly. Recommended:
   - Install/use Python if available.
   - Open a terminal in this folder and run: python -m http.server 8000
   - Open http://localhost:8000 in Chrome/Edge.
4. Click Admin login and sign in with the admin account you created.
5. Upload a small audio file you own or have permission to publish, plus optional cover art.
6. Open the site in another browser/device to confirm the catalog is online.

FILES
-----
index.html       Main website
style.css        Responsive visual design
app.js           Firebase setup, Cloudinary uploads, catalog, admin login, playback
firestore.rules  Suggested Firestore access rules
README.txt       This guide

DATA MODEL
----------
Firestore collection: songs
Each document includes:
title, artist, album, genre, language, year, audioPath, audioUrl,
coverPath, coverUrl, createdAt, updatedAt, createdBy

Firestore collection: admins
Document ID: Firebase Authentication UID of an allowed admin.
Example field: role = "admin"

SAFETY / COPYRIGHT NOTES
------------------------
- The admin login is only as safe as the security rules and your account password.
- Public visitors can read published song metadata and stream the audio files.
- Only users whose UID has a document in /admins/{uid} can create/update/delete catalog items. Cloudinary unsigned upload presets are not secured by Firebase rules; restrict the preset and monitor use.
- Never use open rules such as allow read, write: if true in production.
- The app has client-side upload size checks, but rules also enforce size and content-type limits.
- Audio files should be owned by you or licensed/authorized by the rights holder. This project does not grant music rights.
- Cloudinary free plan has usage quotas and can change; review current limits and pricing before deployment. Audio is uploaded as a Cloudinary video resource.
- Deleting a song from Firestore does not automatically delete its Cloudinary media. Remove orphaned files manually in the Cloudinary dashboard.
- Cloudinary free plan details: https://cloudinary.com/pricing
- Cloudinary audio upload docs: https://cloudinary.com/documentation/audio_transformations
- This is a starter implementation. Before a large public launch, add App Check, backups, moderation/reporting, rate limits, and a clear takedown/contact process.

Official docs:
https://firebase.google.com/docs/web/setup
https://firebase.google.com/docs/firestore/quickstart
https://firebase.google.com/docs/auth/web/password-auth
https://firebase.google.com/docs/firestore/security/get-started
