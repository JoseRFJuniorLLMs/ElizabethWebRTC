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

const pc = new RTCPeerConnection(servers);
let localStream = null;
let remoteStream = null;

const startButton = document.getElementById('startButton');
const finishCallButton = document.getElementById('finishCallButton');
const logImage = document.getElementById('logImage');
const webcamVideo = document.getElementById('webcamVideo');
const remoteVideo = document.getElementById('remoteVideo');

startButton.onclick = async () => {
  
  const notificationSound = document.getElementById('notificationSound');
  notificationSound.play();

  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  remoteStream = new MediaStream();

  localStream.getTracks().forEach((track) => {
    pc.addTrack(track, localStream);
  });

  pc.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remoteStream.addTrack(track);
    });
  };

  webcamVideo.srcObject = localStream;
  remoteVideo.srcObject = remoteStream;

  const callsSnapshot = await firestore.collection('calls').get();
  const existingCallDoc = callsSnapshot.docs[0];
  
  if (existingCallDoc) {
    const notificationSound = document.getElementById('notificationSound');
    notificationSound.play();
    const callDoc = firestore.collection('calls').doc(existingCallDoc.id);
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

  } else {
    const callDoc = firestore.collection('calls').doc();
    const offerCandidates = callDoc.collection('offerCandidates');
    const answerCandidates = callDoc.collection('answerCandidates');

    pc.onicecandidate = (event) => {
      event.candidate && offerCandidates.add(event.candidate.toJSON());
    };

    const offerDescription = await pc.createOffer();
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
        pc.setRemoteDescription(answerDescription);
      }
    });

    answerCandidates.onSnapshot((snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const candidate = new RTCIceCandidate(change.doc.data());
          pc.addIceCandidate(candidate);
        }
      });
    });
  }

  finishCallButton.disabled = false;
  startButton.disabled = true;
};

finishCallButton.onclick = async () => {
  const callsSnapshot = await firestore.collection('calls').get();
  const batch = firestore.batch();

  callsSnapshot.forEach(doc => {
    batch.delete(doc.ref);
  });

  await batch.commit();
  alert('Call has been finished and all call documents have been deleted.');

  pc.close();
  localStream.getTracks().forEach(track => track.stop());
  remoteStream.getTracks().forEach(track => track.stop());

  finishCallButton.disabled = true;
  startButton.disabled = false;
};

// Listen for changes in the 'calls' collection
firestore.collection('calls').onSnapshot((snapshot) => {
  if (!snapshot.empty) {
    logImage.style.display = 'block';
  } else {
    logImage.style.display = 'none';
  }
});

