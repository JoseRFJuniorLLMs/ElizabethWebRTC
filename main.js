import './style.css';

import firebase from 'firebase/app';
import 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCitV86fnwamSTI0Ad_IVyM5y2KLkmqMoM",
  authDomain: "elizabethwebrtc.firebaseapp.com",
  projectId: "elizabethwebrtc",
  storageBucket: "elizabethwebrtc.appspot.com",
  messagingSenderId: "152018904860",
  appId: "1:152018904860:web:c4b969cf9f8d1877d97cd9",
  measurementId: "G-7FSMZY9NWY"
};

console.log("Initializing Firebase...");
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const firestore = firebase.firestore();

const servers = {
  iceServers: [
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
    },
  ],
  iceCandidatePoolSize: 10,
};

// Global State
console.log("Creating RTCPeerConnection...");
const pc = new RTCPeerConnection(servers);
let localStream = null;
let remoteStream = null;

// HTML elements
const webcamButton = document.getElementById('webcamButton');
const webcamVideo = document.getElementById('webcamVideo');
const callButton = document.getElementById('callButton');
const callInput = document.getElementById('callInput');
const answerButton = document.getElementById('answerButton');
const remoteVideo = document.getElementById('remoteVideo');
const hangupButton = document.getElementById('hangupButton');
const finishCallButton = document.getElementById('finishCallButton');
const refreshCallsButton = document.getElementById('refreshCallsButton');
const callList = document.getElementById('callList');

// Função para listar documentos de chamadas
console.log("Setting up event listeners...");
async function listCalls() {
  const callsSnapshot = await firestore.collection('calls').get();
  callList.innerHTML = '';
  callsSnapshot.forEach(doc => {
    // Verificar se o ID do documento não é igual ao ID da chamada que você criou
    console.log("Processing call document:", doc.id);
    if (doc.id !== callInput.value) {
      const option = document.createElement('option');
      option.value = doc.id;
      option.textContent = doc.id;
      callList.appendChild(option);
    }
  });
}

// 1. Setup media sources
webcamButton.onclick = async () => {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  remoteStream = new MediaStream();

  // Push tracks from local stream to peer connection
  localStream.getTracks().forEach((track) => {
    console.log("Adding local track to peer connection:", track.kind);
    pc.addTrack(track, localStream);
  });

  // Pull tracks from remote stream, add to video stream
  pc.ontrack = (event) => {
    console.log("Received remote track:", event.track.kind);
    event.streams[0].getTracks().forEach((track) => {
    console.log("Adding remote track to remote stream:", track.kind);
      remoteStream.addTrack(track);
    });
  };

  webcamVideo.srcObject = localStream;
  remoteVideo.srcObject = remoteStream;

  callButton.disabled = false;
  answerButton.disabled = false;
  webcamButton.disabled = true;
};

// 2. Create an offer
callButton.onclick = async () => {
  console.log("Call button clicked, creating offer...");
  const callDoc = firestore.collection('calls').doc();
  const offerCandidates = callDoc.collection('offerCandidates');
  const answerCandidates = callDoc.collection('answerCandidates');

  callInput.value = callDoc.id;

  pc.onicecandidate = (event) => {
    console.log("ICE candidate generated:", event.candidate);
    event.candidate && offerCandidates.add(event.candidate.toJSON());
  };

  const offerDescription = await pc.createOffer();
  console.log("Offer created:", offerDescription);
  await pc.setLocalDescription(offerDescription);

  const offer = {
    sdp: offerDescription.sdp,
    type: offerDescription.type,
  };

  await callDoc.set({ offer });

  callDoc.onSnapshot((snapshot) => {
    const data = snapshot.data();
    if (!pc.currentRemoteDescription && data?.answer) {
      const answerDescription = new RTCSessionDescription(data.answer);
      console.log("Remote answer received:", answerDescription);
      pc.setRemoteDescription(answerDescription);
    }
  });

  answerCandidates.onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        console.log("Answer candidate added:", change.doc.data());
        const candidate = new RTCIceCandidate(change.doc.data());
        pc.addIceCandidate(candidate);
      }
    });
  });

  hangupButton.disabled = false;
  console.log("Call initiated.");
};

// 3. Answer the call with the unique ID
answerButton.onclick = async () => {
  const callId = callInput.value;
  const callDoc = firestore.collection('calls').doc(callId);
  const answerCandidates = callDoc.collection('answerCandidates');
  const offerCandidates = callDoc.collection('offerCandidates');

  pc.onicecandidate = (event) => {
    event.candidate && answerCandidates.add(event.candidate.toJSON());
  };

  const callData = (await callDoc.get()).data();

  const offerDescription = callData.offer;
  await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

  const answerDescription = await pc.createAnswer();
  await pc.setLocalDescription(answerDescription);

  const answer = {
    type: answerDescription.type,
    sdp: answerDescription.sdp,
  };

  await callDoc.update({ answer });

  offerCandidates.onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        let data = change.doc.data();
        pc.addIceCandidate(new RTCIceCandidate(data));
      }
    });
  });
};

// 4. Clean up the call and documents in Firestore
finishCallButton.onclick = async () => {
  const callsSnapshot = await firestore.collection('calls').get();
  const batch = firestore.batch();

  callsSnapshot.forEach(doc => {
    batch.delete(doc.ref);
    console.log("Deleted....");
  });

  await batch.commit();
  alert('All call documents have been deleted.');
  console.log("All call documents have been deleted.");
};

// Refresh call list
refreshCallsButton.onclick = () => {
  listCalls();
};

// Initial call list load
listCalls();
