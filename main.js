import './style.css';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, getDocs, setDoc, onSnapshot, deleteDoc, updateDoc, addDoc, getDoc } from 'firebase/firestore';
import WaveSurfer from 'wavesurfer.js';
import RecordPlugin from 'wavesurfer.js/dist/plugins/record.esm.js';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC25TEAPAQ6b4HuCB9AWAef0NeaEvsF9M8",
  authDomain: "elizabethrtc.firebaseapp.com",
  projectId: "elizabethrtc",
  storageBucket: "elizabethrtc.appspot.com",
  messagingSenderId: "954247291412",
  appId: "1:954247291412:web:da9caa6f7a7e8ccff7fd01",
  measurementId: "G-FPT1XMMKHS"
};

const firebaseApp = initializeApp(firebaseConfig);
const firestore = getFirestore(firebaseApp);

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
let wavesurfer = null;
let record = null;
let callDocRef = null;
let isCaller = false;

const startButton = document.getElementById('startButton');
const finishCallButton = document.getElementById('finishCallButton');
const logImage = document.getElementById('logImage');
const webcamVideo = document.getElementById('webcamVideo');
const remoteVideo = document.getElementById('remoteVideo');
const startAudioButton = document.getElementById('startAudioButton');

const createWaveSurfer = () => {
  if (wavesurfer) {
    wavesurfer.destroy();
  }
  wavesurfer = WaveSurfer.create({
    container: '#localWaveform',
    waveColor: 'rgb(33, 150, 243)', // Light Blue from image
    progressColor: 'rgb(135, 206, 235)', // Sky Blue
    cursorColor: 'rgb(0, 0, 0)',
    cursorWidth: 6,
    barGap: 3,
    barWidth: 2,
    barHeight: 3,
    barRadius: 100,
    autoScroll: true,
    autoCenter: true,
    interact: true,
    dragToSeek: true,
    fillParent: true
  });

  record = wavesurfer.registerPlugin(RecordPlugin.create({ scrollingWaveform: false, renderRecordedAudio: false }));
  record.on('record-end', (blob) => {
    const container = document.querySelector('#recordings');
    const recordedUrl = URL.createObjectURL(blob);

    const recordedWaveSurfer = WaveSurfer.create({
      container,
      waveColor: 'rgb(33, 150, 243)', // Light Blue from image
      progressColor: 'rgb(135, 206, 235)', // Sky Blue
      cursorColor: 'rgb(0, 0, 0)',
      cursorWidth: 6,
      barGap: 3,
      barWidth: 2,
      barHeight: 3,
      barRadius: 100,
      autoScroll: true,
      autoCenter: true,
      interact: true,
      dragToSeek: true,
      mediaControls: true,
      autoplay: true,
      fillParent: true,
      url: recordedUrl
    });

    const button = container.appendChild(document.createElement('button'));
    button.textContent = 'Play';
    button.onclick = () => recordedWaveSurfer.playPause();
    recordedWaveSurfer.on('pause', () => (button.textContent = 'Play'));
    recordedWaveSurfer.on('play', () => (button.textContent = 'Pause'));

    const link = container.appendChild(document.createElement('a'));
    Object.assign(link, {
      href: recordedUrl,
      download: 'recording.' + (blob.type.split('/')[1] || 'webm'),
    });
    link.textContent = 'Download recording';
  });

  record.on('record-progress', (time) => {
    updateProgress(time);
  });
};

const updateProgress = (time) => {
  const formattedTime = [
    Math.floor((time % 3600000) / 60000),
    Math.floor((time % 60000) / 1000),
  ]
    .map((v) => (v < 10 ? '0' + v : v))
    .join(':');
  document.querySelector('#progress').textContent = formattedTime;
};

const startCall = async (video) => {
  const notificationSound = document.getElementById('notificationSound');
  notificationSound.play();

  localStream = await navigator.mediaDevices.getUserMedia({ video, audio: true });
  remoteStream = new MediaStream();

  localStream.getTracks().forEach((track) => {
    pc.addTrack(track, localStream);
  });

  pc.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remoteStream.addTrack(track);
    });
  };

  if (video) {
    webcamVideo.srcObject = localStream;
  }
  remoteVideo.srcObject = remoteStream;

  // Start WaveSurfer for audio visualization
  createWaveSurfer();
  record.startRecording();

  const callsSnapshot = await getDocs(collection(firestore, 'calls'));
  const existingCallDoc = callsSnapshot.docs[0];

  if (existingCallDoc) {
    callDocRef = doc(firestore, 'calls', existingCallDoc.id);
    const answerCandidates = collection(callDocRef, 'answerCandidates');
    const offerCandidates = collection(callDocRef, 'offerCandidates');

    pc.onicecandidate = (event) => {
      event.candidate && addDoc(answerCandidates, event.candidate.toJSON());
    };

    const callData = existingCallDoc.data();
    const offerDescription = callData.offer;
    await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

    const answerDescription = await pc.createAnswer();
    await pc.setLocalDescription(answerDescription);

    const answer = {
      type: answerDescription.type,
      sdp: answerDescription.sdp,
    };

    await updateDoc(callDocRef, { answer });

    onSnapshot(offerCandidates, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          let data = change.doc.data();
          pc.addIceCandidate(new RTCIceCandidate(data));
        }
      });
    });

  } else {
    callDocRef = doc(collection(firestore, 'calls'));
    const offerCandidates = collection(callDocRef, 'offerCandidates');
    const answerCandidates = collection(callDocRef, 'answerCandidates');

    pc.onicecandidate = (event) => {
      event.candidate && addDoc(offerCandidates, event.candidate.toJSON());
    };

    const offerDescription = await pc.createOffer();
    await pc.setLocalDescription(offerDescription);

    const offer = {
      sdp: offerDescription.sdp,
      type: offerDescription.type,
    };

    await setDoc(callDocRef, { offer });
    isCaller = true;

    onSnapshot(callDocRef, (snapshot) => {
      const data = snapshot.data();
      if (!pc.currentRemoteDescription && data?.answer) {
        const answerDescription = new RTCSessionDescription(data.answer);
        pc.setRemoteDescription(answerDescription);
      }
    });

    onSnapshot(answerCandidates, (snapshot) => {
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
  startAudioButton.disabled = true;
};

startButton.onclick = () => startCall(true);

startAudioButton.onclick = () => startCall(false);

finishCallButton.onclick = async () => {
  if (callDocRef) {
    if (isCaller) {
      const offerCandidatesSnapshot = await getDocs(collection(callDocRef, 'offerCandidates'));
      offerCandidatesSnapshot.forEach(async (candidate) => {
        await deleteDoc(candidate.ref);
      });
      await deleteDoc(callDocRef);
    } else {
      const answerCandidatesSnapshot = await getDocs(collection(callDocRef, 'answerCandidates'));
      answerCandidatesSnapshot.forEach(async (candidate) => {
        await deleteDoc(candidate.ref);
      });
      await updateDoc(callDocRef, { answer: null });
    }
  }

  alert('Your session has been finished.');

  pc.close();
  localStream.getTracks().forEach(track => track.stop());
  remoteStream.getTracks().forEach(track => track.stop());

  finishCallButton.disabled = true;
  startButton.disabled = false;
  startAudioButton.disabled = false;

  if (wavesurfer) {
    wavesurfer.destroy();
    wavesurfer = null;
  }
};

onSnapshot(collection(firestore, 'calls'), (snapshot) => {
  if (!snapshot.empty) {
    logImage.style.display = 'block';
  } else {
    logImage.style.display = 'none';
  }
});

document.querySelector('input[type="checkbox"]').onclick = (e) => {
  scrollingWaveform = e.target.checked;
  createWaveSurfer();
};
