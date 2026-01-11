export type SignalingTransport = {
  on: (event: string, handler: (payload: any) => void) => void;
  off: (event: string, handler: (payload: any) => void) => void;
  emit: (event: string, payload: any) => void;
};

export type WebRtcSignal = {
  roomId: string;
  from: string;
  to?: string;
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
};

export type WebRtcPeerOptions = {
  id: string;
  roomId: string;
  onSignal: (payload: WebRtcSignal) => void;
  onTrack?: (event: RTCTrackEvent) => void;
  onData?: (data: string) => void;
  onStateChange?: (state: RTCPeerConnectionState) => void;
  iceServers?: RTCIceServer[];
  stream?: MediaStream | null;
};

export const createWebRtcPeer = (options: WebRtcPeerOptions) => {
  const pc = new RTCPeerConnection({
    iceServers: options.iceServers ?? [],
  });

  let dataChannel: RTCDataChannel | null = null;

  if (options.stream) {
    options.stream.getTracks().forEach((track) => {
      pc.addTrack(track, options.stream as MediaStream);
    });
  }

  pc.ontrack = (event) => options.onTrack?.(event);
  pc.onconnectionstatechange = () =>
    options.onStateChange?.(pc.connectionState);
  pc.onicecandidate = (event) => {
    if (!event.candidate) return;
    options.onSignal({
      roomId: options.roomId,
      from: options.id,
      candidate: event.candidate.toJSON(),
    });
  };

  pc.ondatachannel = (event) => {
    dataChannel = event.channel;
    dataChannel.onmessage = (msg) => options.onData?.(String(msg.data));
  };

  const ensureDataChannel = () => {
    if (dataChannel) return;
    dataChannel = pc.createDataChannel("chat");
    dataChannel.onmessage = (msg) => options.onData?.(String(msg.data));
  };

  const start = async () => {
    ensureDataChannel();
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    options.onSignal({
      roomId: options.roomId,
      from: options.id,
      description: pc.localDescription ?? offer,
    });
  };

  const handleSignal = async (payload: WebRtcSignal) => {
    if (payload.from === options.id) return;
    if (payload.roomId !== options.roomId) return;

    if (payload.description) {
      await pc.setRemoteDescription(payload.description);
      if (payload.description.type === "offer") {
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        options.onSignal({
          roomId: options.roomId,
          from: options.id,
          description: pc.localDescription ?? answer,
        });
      }
      return;
    }

    if (payload.candidate) {
      try {
        await pc.addIceCandidate(payload.candidate);
      } catch {
        // ignore
      }
    }
  };

  const sendData = (data: string) => {
    dataChannel?.send(data);
  };

  const close = () => {
    dataChannel?.close();
    dataChannel = null;
    pc.close();
  };

  return { pc, start, handleSignal, sendData, close };
};

