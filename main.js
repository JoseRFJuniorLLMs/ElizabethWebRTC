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

const localControls = {
  brightness: document.getElementById('localBrightness'),
  contrast: document.getElementById('localContrast'),
  saturation: document.getElementById('localSaturation'),
  sepia: document.getElementById('localSepia'),
  grayscale: document.getElementById('localGrayscale'),
  invert: document.getElementById('localInvert'),
  gamma: document.getElementById('localGamma'),
  volume: document.getElementById('localVolume'),
  pan: document.getElementById('localPan'),
  tilt: document.getElementById('localTilt'),
  zoom: document.getElementById('localZoom'),
  resolution: document.getElementById('localResolution'),
  size: document.getElementById('localSize')
};

const remoteControls = {
  brightness: document.getElementById('remoteBrightness'),
  contrast: document.getElementById('remoteContrast'),
  saturation: document.getElementById('remoteSaturation'),
  sepia: document.getElementById('remoteSepia'),
  grayscale: document.getElementById('remoteGrayscale'),
  invert: document.getElementById('remoteInvert'),
  gamma: document.getElementById('remoteGamma'),
  volume: document.getElementById('remoteVolume'),
  pan: document.getElementById('remotePan'),
  tilt: document.getElementById('remoteTilt'),
  zoom: document.getElementById('remoteZoom'),
  resolution: document.getElementById('remoteResolution'),
  size: document.getElementById('remoteSize')
};

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

const applyLocalFilters = () => {
  webcamVideo.style.filter = `
    brightness(${localControls.brightness.value})
    contrast(${localControls.contrast.value})
    saturate(${localControls.saturation.value})
    sepia(${localControls.sepia.value})
    grayscale(${localControls.grayscale.value})
    invert(${localControls.invert.value})
    `;
  webcamVideo.style.transform = `
    scale(${localControls.zoom.value})
    rotateX(${localControls.tilt.value}deg)
    `;
};

const applyRemoteFilters = () => {
  remoteVideo.style.filter = `
    brightness(${remoteControls.brightness.value})
    contrast(${remoteControls.contrast.value})
    saturate(${remoteControls.saturation.value})
    sepia(${remoteControls.sepia.value})
    grayscale(${remoteControls.grayscale.value})
    invert(${remoteControls.invert.value})
    `;
  remoteVideo.style.transform = `
    scale(${remoteControls.zoom.value})
    rotateX(${remoteControls.tilt.value}deg)
    `;
};

const setVolume = (videoElement, volume) => {
  videoElement.volume = volume;
};

const setupControlListeners = () => {
  Object.keys(localControls).forEach(control => {
    if (control !== 'volume') {
      localControls[control].addEventListener('input', applyLocalFilters);
    } else {
      localControls[control].addEventListener('input', () => setVolume(webcamVideo, localControls[control].value));
    }
  });

  Object.keys(remoteControls).forEach(control => {
    if (control !== 'volume') {
      remoteControls[control].addEventListener('input', applyRemoteFilters);
    } else {
      remoteControls[control].addEventListener('input', () => setVolume(remoteVideo, remoteControls[control].value));
    }
  });
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

// Inicializa o tamanho do vídeo ao carregar a página
adjustVideoSize();
setupControlListeners();
