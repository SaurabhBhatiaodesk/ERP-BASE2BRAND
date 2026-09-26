/**
 * Browser-side meeting recording — captures the current tab (video + tab
 * audio, i.e. the remote party's voice as heard through Jitsi) mixed with
 * the local microphone (this person's own voice), so the recording has both
 * sides of the conversation. There is no way to start this without a
 * browser permission prompt — that's a hard browser security rule, not a
 * limitation of this code — so it must be called synchronously from a user
 * gesture (e.g. directly inside a button's onClick), before any other
 * `await`, or Chrome will refuse the request.
 */

export type ActiveRecording = {
  displayStream: MediaStream;
  micStream: MediaStream | null;
  audioContext: AudioContext;
  recorder: MediaRecorder;
  chunks: Blob[];
};

export function canRecordTab(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia;
}

export async function startMeetingRecording(): Promise<ActiveRecording> {
  const displayStream = await navigator.mediaDevices.getDisplayMedia({
    video: true,
    audio: true,
    // Chrome-only hints — jump straight to "this tab" instead of the full
    // screen/window/tab picker. Ignored (harmlessly) by other browsers.
    ...({ preferCurrentTab: true, selfBrowserSurface: "include" } as Record<string, unknown>),
  } as MediaStreamConstraints);

  let micStream: MediaStream | null = null;
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    // Mic denied/unavailable — still record with tab audio only (the other party's voice).
  }

  const audioContext = new AudioContext();
  const destination = audioContext.createMediaStreamDestination();
  if (displayStream.getAudioTracks().length > 0) {
    audioContext.createMediaStreamSource(new MediaStream(displayStream.getAudioTracks())).connect(destination);
  }
  if (micStream) {
    audioContext.createMediaStreamSource(micStream).connect(destination);
  }

  const combined = new MediaStream([...displayStream.getVideoTracks(), ...destination.stream.getAudioTracks()]);

  const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
    ? "video/webm;codecs=vp9,opus"
    : "video/webm";
  const chunks: Blob[] = [];
  const recorder = new MediaRecorder(combined, { mimeType });
  recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
  recorder.start(1000);

  return { displayStream, micStream, audioContext, recorder, chunks };
}

export function stopMeetingRecording(active: ActiveRecording): Promise<Blob> {
  return new Promise(resolve => {
    const finish = () => {
      active.displayStream.getTracks().forEach(t => t.stop());
      active.micStream?.getTracks().forEach(t => t.stop());
      void active.audioContext.close();
      resolve(new Blob(active.chunks, { type: "video/webm" }));
    };
    // If the recorder already stopped on its own (e.g. the shared tab/window's
    // track ended — "Stop sharing" clicked, tab closed, etc.), its "stop" event
    // already fired before this listener could be attached, so it will never
    // fire again — waiting for it here would hang this promise forever.
    if (active.recorder.state === "inactive") {
      finish();
      return;
    }
    active.recorder.addEventListener("stop", finish, { once: true });
    active.recorder.stop();
  });
}
