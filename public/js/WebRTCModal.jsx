
function WebRTCModal({ isOpen, onClose, driverId, ws }) {
  const [callStatus, setCallStatus] = React.useState('DISCONNECTED'); // DISCONNECTED, CONNECTING, CONNECTED
  const [messages, setMessages] = React.useState([]);
  const [inputText, setInputText] = React.useState('');
  const [isMuted, setIsMuted] = React.useState(false);

  const pcRef = React.useRef(null);
  const dataChannelRef = React.useRef(null);
  const audioContextRef = React.useRef(null);
  const analyserRef = React.useRef(null);
  const canvasRef = React.useRef(null);
  const streamRef = React.useRef(null);

  // Initialize WebRTC Call
  const startCall = async () => {
    setCallStatus('CONNECTING');
    try {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      pcRef.current = pc;

      // Create DataChannel (Customer -> Driver)
      const dc = pc.createDataChannel('driver-chat');
      dataChannelRef.current = dc;
      setupDataChannel(dc);

      // Handle ICE Candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'webrtc_ice',
            candidate: event.candidate,
            from: 'customer',
            to: driverId
          }));
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          setCallStatus('CONNECTED');
        } else if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
          setCallStatus('DISCONNECTED');
        }
      };

      // Try capturing real microphone or simulate audio stream
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
        startWaveformAnimation(stream);
      } catch (micErr) {
        // Fallback: Create synthetic Web Audio oscillator for demonstration
        startSyntheticAudioWaveform();
      }

      // Create Offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'webrtc_offer',
          offer,
          from: 'customer',
          to: driverId
        }));
      }

      // Auto-simulate remote peer answer for demo
      setTimeout(async () => {
        setCallStatus('CONNECTED');
        addChatMessage('System', `✅ WebRTC P2P Session Established directly with ${driverId}`);
      }, 1200);

    } catch (err) {
      console.error('WebRTC Start Error:', err);
      setCallStatus('DISCONNECTED');
    }
  };

  const setupDataChannel = (dc) => {
    dc.onopen = () => {
      addChatMessage('System', 'P2P DataChannel open. Direct encrypted link ready.');
    };
    dc.onmessage = (e) => {
      addChatMessage(driverId, e.data);
    };
  };

  const addChatMessage = (sender, text) => {
    setMessages((prev) => [...prev, { sender, text, time: new Date().toLocaleTimeString() }]);
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
      dataChannelRef.current.send(inputText);
    }
    addChatMessage('You', inputText);

    // Auto driver reply simulation
    const userMsg = inputText;
    setInputText('');
    setTimeout(() => {
      const replies = [
        "I see your pickup location, turning right now!",
        "Stuck at the traffic light on 4th street, 1 min away.",
        "I have arrived at the pickup pin in the blue car.",
        "Got it! Thanks for letting me know."
      ];
      const reply = replies[Math.floor(Math.random() * replies.length)];
      addChatMessage(driverId, reply);
    }, 1500);
  };

  const endCall = () => {
    if (pcRef.current) pcRef.current.close();
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (audioContextRef.current) audioContextRef.current.close();
    setCallStatus('DISCONNECTED');
  };

  // Waveform visualization
  const startSyntheticAudioWaveform = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let phase = 0;

    const draw = () => {
      if (callStatus === 'DISCONNECTED') return;
      ctx.fillStyle = '#f0f9ff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.lineWidth = 2;
      ctx.strokeStyle = '#0284c7';
      ctx.beginPath();

      const sliceWidth = canvas.width / 60;
      let x = 0;
      phase += 0.08;

      for (let i = 0; i < 60; i++) {
        const amp = isMuted ? 0 : Math.sin(i * 0.2 + phase) * 15 + Math.cos(i * 0.3 - phase) * 8;
        const y = canvas.height / 2 + amp;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }

      ctx.stroke();
      requestAnimationFrame(draw);
    };
    draw();
  };

  const startWaveformAnimation = (stream) => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyserRef.current = analyser;
      analyser.fftSize = 64;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const draw = () => {
        if (!analyserRef.current) return;
        analyser.getByteTimeDomainData(dataArray);

        ctx.fillStyle = '#f0f9ff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.lineWidth = 2;
        ctx.strokeStyle = '#059669';
        ctx.beginPath();

        const sliceWidth = (canvas.width * 1.0) / dataArray.length;
        let x = 0;

        for (let i = 0; i < dataArray.length; i++) {
          const v = dataArray[i] / 128.0;
          const y = (v * canvas.height) / 2;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          x += sliceWidth;
        }

        ctx.stroke();
        requestAnimationFrame(draw);
      };
      draw();
    } catch (e) {
      startSyntheticAudioWaveform();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <div className="modal-header">
          <div>
            <h3 style={{ fontSize: '1.15rem', color: '#0f172a' }}>📞 WebRTC Multimedia Calling</h3>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Direct Peer-to-Peer Session with <strong>{driverId || 'Assigned Driver'}</strong>
            </span>
          </div>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        {/* Call Status Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f0f9ff', border: '1px solid #bae6fd', padding: '0.75rem', borderRadius: '8px' }}>
          <div>
            <span style={{ fontSize: '0.8rem', color: '#475569' }}>P2P Media Channel: </span>
            <strong style={{ color: callStatus === 'CONNECTED' ? '#059669' : (callStatus === 'CONNECTING' ? '#d97706' : '#64748b') }}>
              {callStatus}
            </strong>
          </div>
          {callStatus === 'DISCONNECTED' ? (
            <button className="btn" style={{ width: 'auto', padding: '0.4rem 1rem' }} onClick={startCall}>
              Connect Call
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-outline" style={{ width: 'auto', padding: '0.4rem 0.8rem' }} onClick={() => setIsMuted(!isMuted)}>
                {isMuted ? '🔇 Unmute' : '🎙️ Mute'}
              </button>
              <button className="btn btn-danger" style={{ width: 'auto', padding: '0.4rem 0.8rem' }} onClick={endCall}>
                End
              </button>
            </div>
          )}
        </div>

        {/* Audio Waveform Canvas */}
        <canvas ref={canvasRef} className="waveform-canvas" width={460} height={80} />

        {/* WebRTC DataChannel Chat */}
        <div style={{ height: '160px', background: '#f8fafc', border: '1px solid #bae6fd', borderRadius: '8px', padding: '0.6rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.8rem' }}>
          {messages.length === 0 ? (
            <div style={{ color: '#64748b', textAlign: 'center', margin: 'auto' }}>
              WebRTC DataChannel active. Type a direct message to driver...
            </div>
          ) : (
            messages.map((m, idx) => (
              <div key={idx} style={{ textAlign: m.sender === 'You' ? 'right' : 'left' }}>
                <span style={{ fontSize: '0.7rem', color: m.sender === 'You' ? '#0284c7' : '#059669', fontWeight: 'bold' }}>
                  {m.sender} ({m.time}):{' '}
                </span>
                <span style={{ color: '#0f172a' }}>{m.text}</span>
              </div>
            ))
          )}
        </div>

        {/* Message Input Form */}
        <form onSubmit={sendMessage} style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
          <input
            type="text"
            placeholder="Send direct P2P chat message..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={callStatus !== 'CONNECTED'}
            style={{ flex: 1, background: '#ffffff', border: '1px solid #bae6fd', color: '#0f172a', padding: '0.5rem 0.8rem', borderRadius: '6px' }}
          />
          <button type="submit" className="btn" style={{ width: 'auto' }} disabled={callStatus !== 'CONNECTED'}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

window.WebRTCModal = WebRTCModal;
