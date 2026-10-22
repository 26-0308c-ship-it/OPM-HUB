import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

/*
  SETUP: Replace the placeholder firebaseConfig values below with the config
  from Firebase Console > Project settings > Your apps > Web app.
*/
const firebaseConfig = {
  apiKey: "AIzaSyDXV4iUWRVmc9k6-orPt0CgkXuJMDngp7g",
  authDomain: "opm-hub-ba676.firebaseapp.com",
  projectId: "opm-hub-ba676",
  storageBucket: "opm-hub-ba676.firebasestorage.app",
  messagingSenderId: "339726518997",
  appId: "1:339726518997:web:0fb301cd19caad7985305c",
  measurementId: "G-0MDQ69LTQV"
};

/* Cloudinary free media hosting setup.
   Create an UNSIGNED upload preset in Cloudinary and enter its values here.
   Never put a Cloudinary API secret in browser code.
*/
const cloudinaryConfig = {
  cloudName: "kskhguqn",
  uploadPreset: "opm_hub_upload"
};

const $ = (id) => document.getElementById(id);
const audio = $("audio");
let app, auth, db, currentUser = null, tracks = [], currentTrackId = null, currentView = "discover", activeGenre = "all", unsubscribeTracks = null, toastTimer;
const favorites = new Set(JSON.parse(localStorage.getItem("opmHubFavorites") || "[]"));
const gradients = ["linear-gradient(135deg,#ff5b99,#542b78)","linear-gradient(135deg,#ffb36b,#9a4c75)","linear-gradient(135deg,#6c7bff,#3d3269)","linear-gradient(135deg,#45c7b8,#25506c)","linear-gradient(135deg,#c67bff,#512c71)","linear-gradient(135deg,#ff7c62,#8d315f)"];

function showToast(message){$("toast").textContent=message;$("toast").classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>$("toast").classList.remove("show"),2800);}
function safeText(value){return String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));}
function formatTime(seconds){if(!Number.isFinite(seconds)||seconds<0)return"0:00";return Math.floor(seconds/60)+":"+String(Math.floor(seconds%60)).padStart(2,"0");}
function hash(s){let h=0;for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))|0;return h;}
function saveFavorites(){localStorage.setItem("opmHubFavorites",JSON.stringify([...favorites]));$("favoriteCount").textContent=favorites.size;}
function setStatus(message, bad=false){$("statusBanner").textContent=message;$("statusBanner").classList.toggle("error",bad);$("statusBanner").classList.remove("hidden");}
function mediaCover(track){const el=document.createElement("div");el.className="cover";el.style.background=gradients[Math.abs(hash(track.artist||track.id||"opm"))%gradients.length];if(track.coverUrl){const img=document.createElement("img");img.src=track.coverUrl;img.alt="Cover artwork for "+track.title;img.loading="lazy";el.appendChild(img);}else{const symbol=document.createElement("div");symbol.className="cover-symbol";symbol.textContent="♫";el.appendChild(symbol);}return el;}
function visibleTracks(){const q=$("searchInput").value.trim().toLowerCase();return tracks.filter(t=>(currentView!=="favorites"||favorites.has(t.id))&&(activeGenre==="all"||String(t.genre||"").toLowerCase()===activeGenre.toLowerCase())&&(!q||[t.title,t.artist,t.album,t.genre,t.language].some(v=>String(v||"").toLowerCase().includes(q))));}
function render(){
 const items=visibleTracks(),grid=$("contentGrid");grid.innerHTML="";
 $("sectionTitle").textContent=({discover:"Explore the catalog",artists:"Artists",albums:"Albums",favorites:"Your favorites"})[currentView]||"Explore the catalog";
 $("resultCount").textContent=`${items.length} ${currentView==="artists"?"artists":currentView==="albums"?"albums":"tracks"}`;
 $("emptyState").classList.toggle("hidden",items.length!==0);$("genreChips").classList.toggle("hidden",currentView==="artists"||currentView==="albums");
 if(currentView==="artists"){const map=new Map();items.forEach(t=>{if(!map.has(t.artist.toLowerCase()))map.set(t.artist.toLowerCase(),t)});[...map.values()].forEach((t,i)=>{const c=document.createElement("article");c.className="artist-card";c.appendChild(mediaCover({...t,coverUrl:null}));const h=document.createElement("h3");h.textContent=t.artist;const p=document.createElement("p");p.textContent=items.filter(x=>x.artist.toLowerCase()===t.artist.toLowerCase()).length+" track(s) · "+(t.genre||"Filipino music");const b=document.createElement("button");b.className="button button-outline";b.textContent="View tracks";b.onclick=()=>{$("searchInput").value=t.artist;currentView="discover";setNav();render();};c.append(h,p,b);grid.appendChild(c);});}
 else if(currentView==="albums"){const map=new Map();items.filter(t=>t.album).forEach(t=>{const k=(t.artist+"::"+t.album).toLowerCase();if(!map.has(k))map.set(k,t)});[...map.values()].forEach(t=>{const c=document.createElement("article");c.className="album-card";c.appendChild(mediaCover(t));const h=document.createElement("h3");h.textContent=t.album;const p=document.createElement("p");p.textContent=t.artist+" · "+(t.year||"Year unknown");const b=document.createElement("button");b.className="button button-outline";b.textContent="View album tracks";b.onclick=()=>{$("searchInput").value=t.album;currentView="discover";setNav();render();};c.append(h,p,b);grid.appendChild(c);});}
 else items.forEach(t=>grid.appendChild(makeTrackCard(t)));
 saveFavorites();renderAdminList();updatePlayerFavorite();
}
function makeTrackCard(t){const card=document.createElement("article");card.className="track-card";const cover=mediaCover(t);const play=document.createElement("button");play.className="card-play";play.textContent=currentTrackId===t.id&&!audio.paused?"Ⅱ":"▶";play.setAttribute("aria-label","Play "+t.title);play.onclick=()=>playTrack(t.id);cover.appendChild(play);card.appendChild(cover);const info=document.createElement("div");info.className="track-info";const main=document.createElement("div");main.style.minWidth="0";const h=document.createElement("h3");h.textContent=t.title;const p=document.createElement("p");p.textContent=t.artist;main.append(h,p);const heart=document.createElement("button");heart.className="heart-button"+(favorites.has(t.id)?" favorited":"");heart.textContent=favorites.has(t.id)?"♥":"♡";heart.onclick=()=>{favorites.has(t.id)?favorites.delete(t.id):favorites.add(t.id);render();};info.append(main,heart);card.appendChild(info);const tags=document.createElement("div");tags.className="track-tags";tags.innerHTML=`<span class="tag">${safeText(t.genre||"OPM")}</span><span class="tag tag-year">${safeText(t.year||"—")}</span>`;card.appendChild(tags);return card;}
function setNav(){document.querySelectorAll(".nav-link").forEach(b=>b.classList.toggle("active",b.dataset.view===currentView));}
async function playTrack(id){const t=tracks.find(x=>x.id===id);if(!t?.audioUrl)return showToast("This track has no audio URL.");currentTrackId=id;audio.src=t.audioUrl;$("playerTitle").textContent=t.title;$("playerArtist").textContent=t.artist+(t.album?" · "+t.album:"");$("playerCover").innerHTML=t.coverUrl?`<img src="${safeText(t.coverUrl)}" alt="">`:"♫";try{await audio.play();$("playerStatus").textContent="Now playing";}catch(e){showToast("Playback could not start. Press play again.");}render();}
function updatePlayerFavorite(){$("playerFavorite").textContent=currentTrackId&&favorites.has(currentTrackId)?"♥":"♡";$("playerFavorite").style.color=currentTrackId&&favorites.has(currentTrackId)?"var(--pink)":"";}
function renderAdminList(){const host=$("adminSongList");if(!host)return;host.innerHTML="";if(!currentUser){host.innerHTML='<p class="small-note">Sign in to manage the catalog.</p>';return;}if(!tracks.length){host.innerHTML='<p class="small-note">No tracks yet. Add your first authorized track above.</p>';return;}tracks.forEach(t=>{const row=document.createElement("div");row.className="admin-row";const main=document.createElement("div");main.className="admin-row-main";const strong=document.createElement("strong");strong.textContent=t.title;const detail=document.createElement("span");detail.textContent=t.artist+" · "+t.genre+(t.album?" · "+t.album:"");main.append(strong,detail);const edit=document.createElement("button");edit.textContent="Edit";edit.onclick=()=>beginEdit(t);const del=document.createElement("button");del.className="delete";del.textContent="Delete";del.onclick=()=>deleteTrack(t);row.append(main,edit,del);host.appendChild(row);});}
function beginEdit(t){$("editId").value=t.id;$("songTitle").value=t.title;$("artistName").value=t.artist;$("albumName").value=t.album||"";$("songGenre").value=t.genre||"OPM";$("songLanguage").value=t.language||"";$("songYear").value=t.year||"";$("audioFile").required=false;$("permissionCheck").checked=true;$("saveSongButton").textContent="Save changes";$("cancelEdit").classList.remove("hidden");$("formMessage").textContent="Leave file inputs empty to keep existing media.";}
function resetForm(){$("songForm").reset();$("editId").value="";$("audioFile").required=true;$("saveSongButton").textContent="Upload track";$("cancelEdit").classList.add("hidden");$("formMessage").textContent="";}
async function uploadFile(file, kind){
 if(!cloudinaryConfig.cloudName || cloudinaryConfig.cloudName.startsWith("PASTE_") || !cloudinaryConfig.uploadPreset || cloudinaryConfig.uploadPreset.startsWith("PASTE_")) throw new Error("Cloudinary setup is incomplete. Add cloudName and uploadPreset in app.js.");
 const resourceType = kind === "audio" ? "video" : "image"; // Cloudinary handles audio through its video resource type.
 const endpoint = `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/${resourceType}/upload`;
 const body = new FormData(); body.append("file", file); body.append("upload_preset", cloudinaryConfig.uploadPreset);
 body.append("folder", `opm-hub/${kind}`);
 const response = await fetch(endpoint, { method: "POST", body });
 const result = await response.json();
 if(!response.ok) throw new Error(result?.error?.message || "Cloudinary upload failed.");
 return result.secure_url;
}
// Browser-only uploads cannot securely delete Cloudinary assets without a private server-side API secret.
// Track deletion removes the Firestore catalog entry; clean up orphaned media in the Cloudinary dashboard.
async function removeStorageFile(path){ if(path) console.info("Media cleanup is manual in Cloudinary dashboard for:", path); }
async function deleteTrack(t){if(!confirm(`Delete "${t.title}" from the online catalog?`))return;try{await deleteDoc(doc(db,"songs",t.id));await removeStorageFile(t.audioPath);await removeStorageFile(t.coverPath);favorites.delete(t.id);showToast("Track deleted.");}catch(e){console.error(e);showToast("Delete failed. Check Firebase security rules.");}}
function startCatalogListener(){if(unsubscribeTracks)unsubscribeTracks();const q=query(collection(db,"songs"),orderBy("createdAt","desc"));unsubscribeTracks=onSnapshot(q,snapshot=>{tracks=snapshot.docs.map(d=>({id:d.id,...d.data()}));render();setStatus(`${tracks.length} track(s) in the online catalog.`);},error=>{console.error(error);setStatus("Could not load catalog. Check Firestore setup and security rules.",true);});}
function initializeFirebase(){if(firebaseConfig.apiKey.startsWith("PASTE_")||firebaseConfig.projectId.startsWith("PASTE_")){setStatus("Firebase setup needed: follow README.txt, then add your web app config in app.js.",true);$("resultCount").textContent="Setup required";return;}try{app=initializeApp(firebaseConfig);auth=getAuth(app);db=getFirestore(app);startCatalogListener();onAuthStateChanged(auth,user=>{currentUser=user;$("authPanel").classList.toggle("hidden",!!user);$("adminPanel").classList.toggle("hidden",!user);$("adminToggle").textContent=user?"Admin studio":"Admin login";if(user)showToast("Admin signed in.");renderAdminList();});}catch(e){console.error(e);setStatus("Firebase could not initialize. Check the configuration in app.js.",true);}}
document.querySelectorAll(".nav-link").forEach(b=>b.onclick=()=>{currentView=b.dataset.view;setNav();render();$("catalog").scrollIntoView({behavior:"smooth"});});
document.querySelectorAll(".chip").forEach(b=>b.onclick=()=>{activeGenre=b.dataset.genre;$("genreFilter").value=activeGenre;document.querySelectorAll(".chip").forEach(c=>c.classList.toggle("selected",c===b));render();});
$("searchInput").oninput=render;$("genreFilter").onchange=()=>{activeGenre=$("genreFilter").value;document.querySelectorAll(".chip").forEach(c=>c.classList.toggle("selected",c.dataset.genre===activeGenre));render();};
$("clearFilters").onclick=()=>{$("searchInput").value="";$("genreFilter").value="all";activeGenre="all";document.querySelectorAll(".chip").forEach(c=>c.classList.toggle("selected",c.dataset.genre==="all"));render();};
$("adminToggle").onclick=()=>$("adminDialog").showModal();$("closeAdmin").onclick=()=>$("adminDialog").close();$("closeInfo").onclick=()=>$("infoDialog").close();$("infoDone").onclick=()=>$("infoDialog").close();$("submitMusicButton").onclick=()=>$("infoDialog").showModal();$("cancelEdit").onclick=resetForm;
$("loginForm").onsubmit=async e=>{e.preventDefault();$("loginMessage").textContent="Signing in…";try{await signInWithEmailAndPassword(auth,$("adminEmail").value.trim(),$("adminPassword").value);$("loginMessage").textContent="";}catch(err){console.error(err);$("loginMessage").textContent="Login failed. Check the email, password, and Firebase Authentication setup.";}};$("logoutButton").onclick=()=>signOut(auth);
$("songForm").onsubmit=async e=>{e.preventDefault();if(!currentUser)return showToast("Please sign in as admin.");if(!$("permissionCheck").checked)return;const editing=$("editId").value,old=editing?tracks.find(t=>t.id===editing):null,audioFile=$("audioFile").files[0],coverFile=$("coverFile").files[0];if(!editing&&!audioFile){$("formMessage").textContent="Choose an audio file.";return;}if(audioFile&&!audioFile.type.startsWith("audio/")){$("formMessage").textContent="Choose a valid audio file.";return;}if(audioFile&&audioFile.size>50*1024*1024){$("formMessage").textContent="Audio file exceeds the 50 MB demo limit. Use a smaller file.";return;}if(coverFile&&!coverFile.type.startsWith("image/")){$("formMessage").textContent="Choose a valid image file.";return;}
 $("saveSongButton").disabled=true;$("saveSongButton").textContent="Uploading…";$("formMessage").textContent="Uploading files and saving catalog data…";
 let audioPath=old?.audioPath||"",audioUrl=old?.audioUrl||"",coverPath=old?.coverPath||"",coverUrl=old?.coverUrl||"";
 try{
  const id=editing||crypto.randomUUID();
  if(audioFile){const url=await uploadFile(audioFile,"audio");if(old?.audioPath)await removeStorageFile(old.audioPath);audioPath="";audioUrl=url;}
  if(coverFile){const url=await uploadFile(coverFile,"cover");if(old?.coverPath)await removeStorageFile(old.coverPath);coverPath="";coverUrl=url;}
  const data={title:$("songTitle").value.trim(),artist:$("artistName").value.trim(),album:$("albumName").value.trim(),genre:$("songGenre").value,language:$("songLanguage").value.trim(),year:$("songYear").value?Number($("songYear").value):null,audioPath,audioUrl,coverPath,coverUrl,updatedAt:serverTimestamp()};
  if(editing)await updateDoc(doc(db,"songs",editing),data);else await addDoc(collection(db,"songs"),{...data,createdAt:serverTimestamp(),createdBy:currentUser.uid});
  resetForm();showToast(editing?"Track updated online.":"Track uploaded online.");
 }catch(err){console.error(err);$("formMessage").textContent="Upload failed. Check Cloudinary cloud name, unsigned preset, file limits, and Firestore rules.";showToast("Upload failed. See setup guide and browser console.");}
 finally{$("saveSongButton").disabled=false;if(!$("editId").value)$("saveSongButton").textContent="Upload track";}
};
$("playButton").onclick=()=>{if(!currentTrackId)return showToast("Choose a track first.");audio.paused?audio.play().catch(()=>showToast("Playback failed.")):audio.pause();};
function changeTrack(delta){const playable=tracks.filter(t=>t.audioUrl);if(!playable.length)return showToast("No playable tracks in the catalog.");let i=playable.findIndex(t=>t.id===currentTrackId);i=i<0?0:(i+delta+playable.length)%playable.length;playTrack(playable[i].id);}
$("prevButton").onclick=()=>changeTrack(-1);$("nextButton").onclick=()=>changeTrack(1);$("playerFavorite").onclick=()=>{if(!currentTrackId)return showToast("Choose a track first.");favorites.has(currentTrackId)?favorites.delete(currentTrackId):favorites.add(currentTrackId);render();};$("volumeToggle").onclick=()=>{audio.muted=!audio.muted;$("volumeToggle").textContent=audio.muted?"🔇":"🔊";};
audio.onplay=()=>{$("playButton").textContent="Ⅱ";$("playerStatus").textContent="Now playing";render();};audio.onpause=()=>{$("playButton").textContent="▶";if(!audio.ended)$("playerStatus").textContent="Paused";render();};audio.ontimeupdate=()=>{$("currentTime").textContent=formatTime(audio.currentTime);$("duration").textContent=formatTime(audio.duration);$("progress").value=audio.duration?audio.currentTime/audio.duration*100:0;};audio.onended=()=>changeTrack(1);$("progress").oninput=()=>{if(audio.duration)audio.currentTime=Number($("progress").value)/100*audio.duration;};
$("year").textContent=new Date().getFullYear();$("favoriteCount").textContent=favorites.size;render();initializeFirebase();
