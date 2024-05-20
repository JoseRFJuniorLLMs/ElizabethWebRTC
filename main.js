import './style.css';
import firebase from 'firebase/app';
import 'firebase/firestore';
import WaveSurfer from 'wavesurfer.js';
import RecordPlugin from 'wavesurfer.js/dist/plugins/record.esm.js';

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
let wavesurfer = null;
let record = null;

const startButton = document.getElementById('startButton');
const finishCallButton = document.getElementById('finishCallButton');
const logImage = document.getElementById('logImage');
const webcamVideo = document.getElementById('webcamVideo');
const remoteVideo = document.getElementById('remoteVideo');
const startAudioButton = document.getElementById('startAudioButton');
const localSizeControl = document.getElementById('localSize');

const localControls = document.getElementById('localControls');
const remoteControls = document.getElementById('remoteControls');


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

const setVolume = (videoElement, volume) => {
  videoElement.volume = volume;
};


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

  // Start WaveSurfer for audio visualization
  createWaveSurfer();
  record.startRecording();

  const callsSnapshot = await firestore.collection('calls').get();
  const existingCallDoc = callsSnapshot.docs[0];

  if (existingCallDoc) {
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

  startAudioButton.disabled = false;
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
  startAudioButton.disabled = true;

  if (wavesurfer) {
    wavesurfer.destroy();
    wavesurfer = null;
  }
};

firestore.collection('calls').onSnapshot((snapshot) => {
  if (!snapshot.empty) {
    logImage.style.display = 'block';
  } else {
    logImage.style.display = 'none';
  }
});

startAudioButton.onclick = () => {
  const notificationSound = document.getElementById('notificationSound');
  notificationSound.play();
  createWaveSurfer();
  record.startRecording();
};

document.querySelector('input[type="checkbox"]').onclick = (e) => {
  scrollingWaveform = e.target.checked;
  createWaveSurfer();
};

// Função para ajustar o tamanho do vídeo conforme o controle de tamanho
const adjustVideoSize = () => {
  const size = localSizeControl.value;
  webcamVideo.style.transform = `scale(${size})`;
};

// Adiciona o evento para ajustar o tamanho do vídeo quando o controle for alterado
localSizeControl.addEventListener('input', adjustVideoSize);

const addVideoControlListeners = (controlsContainer, videoElement) => {
  controlsContainer.querySelectorAll('input[type="range"], select').forEach(control => {
    control.addEventListener('input', (event) => {
      const { id, value } = event.target;
      switch (id) {
        case 'localBrightness':
        case 'remoteBrightness':
          videoElement.style.filter = `brightness(${value})`;
          break;
        case 'localContrast':
        case 'remoteContrast':
          videoElement.style.filter += ` contrast(${value})`;
          break;
        case 'localSaturation':
        case 'remoteSaturation':
          videoElement.style.filter += ` saturate(${value})`;
          break;
        case 'localSepia':
        case 'remoteSepia':
          videoElement.style.filter += ` sepia(${value})`;
          break;
        case 'localGrayscale':
        case 'remoteGrayscale':
          videoElement.style.filter += ` grayscale(${value})`;
          break;
        case 'localInvert':
        case 'remoteInvert':
          videoElement.style.filter += ` invert(${value})`;
          break;
        case 'localGamma':
        case 'remoteGamma':
          videoElement.style.filter += ` contrast(${value})`;
          break;
        case 'localVolume':
        case 'remoteVolume':
          videoElement.volume = value;
          break;
        case 'localPan':
        case 'remotePan':
          videoElement.style.objectPosition = `${value * 100}% center`;
          break;
        case 'localTilt':
        case 'remoteTilt':
          videoElement.style.transform = `rotate(${value}deg)`;
          break;
        case 'localZoom':
        case 'remoteZoom':
          videoElement.style.transform += ` scale(${value})`;
          break;
        case 'localResolution':
        case 'remoteResolution':
          changeResolution(videoElement, value);
          break;
      }
    });
  });
};

const changeResolution = (videoElement, resolution) => {
  switch (resolution) {
    case 'qvga':
      videoElement.width = 320;
      videoElement.height = 240;
      break;
    case 'vga':
      videoElement.width = 640;
      videoElement.height = 480;
      break;
    case 'hd':
      videoElement.width = 1280;
      videoElement.height = 720;
      break;
    case 'fullhd':
      videoElement.width = 1920;
      videoElement.height = 1080;
      break;
    default:
      videoElement.width = 640;
      videoElement.height = 480;
      break;
  }
};

addVideoControlListeners(localControls, webcamVideo);
addVideoControlListeners(remoteControls, remoteVideo);
adjustVideoSize();