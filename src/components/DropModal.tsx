import React, { useState, useRef, useEffect } from 'react';
import { Knot, Person, Thread } from '../types';
import { analyzeDropAPI, transcribeAudioAPI, DropAnalysisResult } from '../api';

interface DropModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveKnot: (knotData: Partial<Knot>) => void;
  onResolveExistingKnot: (knotId: string, evidenceText: string) => void;
  existingKnots: Knot[];
  people: Person[];
  threads: Thread[];
  autoStartVoice?: boolean;
}

export const DropModal: React.FC<DropModalProps> = ({
  isOpen,
  onClose,
  onSaveKnot,
  onResolveExistingKnot,
  existingKnots,
  threads,
  autoStartVoice = false,
}) => {
  const [inputText, setInputText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [extracted, setExtracted] = useState<DropAnalysisResult | null>(null);

  // Voice recording states
  const [isRecording, setIsRecording] = useState(false);
  const [voiceState, setVoiceState] = useState<'idle' | 'requesting' | 'listening' | 'processing' | 'error'>('idle');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [transcriptPreview, setTranscriptPreview] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isVoiceSource, setIsVoiceSource] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordedMimeTypeRef = useRef<string>('audio/webm');
  const timerRef = useRef<any>(null);

  // Auto-start voice if requested from parent
  useEffect(() => {
    if (isOpen && autoStartVoice) {
      handleStartVoice();
    }
  }, [isOpen, autoStartVoice]);

  // Cleanup media recorder on close or unmount
  useEffect(() => {
    if (!isOpen) {
      stopTracksAndTimer();
      setIsRecording(false);
      setVoiceState('idle');
      setVoiceError(null);
      setTranscriptPreview(null);
      setRecordingSeconds(0);
    }
  }, [isOpen]);

  const stopTracksAndTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setIsVoiceSource(false);
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => setFilePreview(reader.result as string);
        reader.readAsDataURL(file);
      }
    }
  };

  // Real Browser Microphone Voice Input using MediaRecorder & Server-side /api/transcribe
  const handleStartVoice = async () => {
    setVoiceError(null);
    setTranscriptPreview(null);
    setVoiceState('requesting');
    audioChunksRef.current = [];
    setRecordingSeconds(0);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setVoiceError('Microphone recording is not supported in this browser. Please use Chrome, Edge, or Safari.');
      setVoiceState('error');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      // Select compatible audio mime type
      const possibleTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
        'audio/wav',
      ];
      let mimeType = '';
      for (const t of possibleTypes) {
        if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) {
          mimeType = t;
          break;
        }
      }

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recordedMimeTypeRef.current = mimeType || 'audio/webm';

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach((track) => track.stop());
          audioStreamRef.current = null;
        }
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        if (audioChunksRef.current.length === 0) {
          setVoiceError('No audio was recorded. Please press voice and speak clearly.');
          setVoiceState('error');
          return;
        }

        setVoiceState('processing');

        try {
          const audioBlob = new Blob(audioChunksRef.current, { type: recordedMimeTypeRef.current });
          const reader = new FileReader();

          reader.onloadend = async () => {
            try {
              const dataUrl = reader.result as string;
              const base64 = dataUrl.split(',')[1];
              if (!base64) {
                throw new Error('Failed to encode audio for transcription.');
              }

              // Send to server-side /api/transcribe (uses Hugging Face Whisper via HF_TOKEN)
              const res = await transcribeAudioAPI(base64, recordedMimeTypeRef.current);

              if (res.success && res.transcript && res.transcript.trim()) {
                const text = res.transcript.trim();
                setInputText(text);
                setTranscriptPreview(text);
                setIsVoiceSource(true);
                setVoiceState('idle');

                // Automatically pass through existing Gemini knot-analysis workflow exactly like typed text!
                await executeAnalysis(text, undefined, undefined, 'Voice');
              } else {
                setVoiceError(res.error || 'No speech was recognized. Please try speaking again.');
                setVoiceState('error');
              }
            } catch (err: any) {
              console.error('Transcription error:', err);
              setVoiceError(err?.message || 'Failed to transcribe audio from server.');
              setVoiceState('error');
            }
          };

          reader.readAsDataURL(audioBlob);
        } catch (err: any) {
          setVoiceError(err?.message || 'Error processing audio recording.');
          setVoiceState('error');
        }
      };

      recorder.start(200);
      setIsRecording(true);
      setVoiceState('listening');

      // Start duration counter
      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Microphone access denied or error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setVoiceError('Microphone permission was denied. Please allow microphone access in your browser address bar.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setVoiceError('No microphone found on your device. Please plug in a microphone.');
      } else {
        setVoiceError(err.message || 'Could not access your microphone.');
      }
      setVoiceState('error');
      setIsRecording(false);
    }
  };

  const handleStopVoice = () => {
    setIsRecording(false);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const executeAnalysis = async (
    textToAnalyze: string,
    imgPreview?: string,
    fileType?: string,
    customSource?: string
  ) => {
    setIsAnalyzing(true);
    try {
      const result = await analyzeDropAPI(
        textToAnalyze,
        imgPreview || undefined,
        fileType,
        existingKnots,
        customSource || (imgPreview ? undefined : isVoiceSource ? 'Voice' : 'Typed message')
      );
      setExtracted(result);
    } catch (err) {
      console.error('Analysis error:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAnalyze = async () => {
    if (!inputText.trim() && !filePreview) {
      alert('Please enter a message, upload a screenshot, or use voice input.');
      return;
    }
    await executeAnalysis(
      inputText,
      filePreview || undefined,
      selectedFile?.type,
      isVoiceSource ? 'Voice' : undefined
    );
  };

  const handleConfirmSave = () => {
    if (!extracted) return;

    if (extracted.resolutionDetected && extracted.possibleResolutionId) {
      onResolveExistingKnot(
        extracted.possibleResolutionId,
        extracted.resolutionEvidence || `Evidence provided: ${extracted.source}`
      );
      onClose();
      return;
    }

    const sourceName = isVoiceSource || extracted.source === 'Voice' ? 'Voice' : selectedFile ? `Screenshot: ${selectedFile.name}` : 'Dropped message';

    onSaveKnot({
      title: extracted.title,
      person: extracted.person,
      from: extracted.from,
      to: extracted.to,
      waitingOn: extracted.waitingOn || extracted.person,
      type: extracted.type,
      status: extracted.status,
      threadTitle: extracted.threadTitle || 'Personal',
      thing: extracted.thing,
      dueDate: extracted.expectedDate,
      expectedDate: extracted.expectedDate,
      nextAction: extracted.nextAction,
      resolutionCondition: extracted.resolutionCondition,
      confidence: extracted.confidence || 'High',
      evidence: [
        {
          source: sourceName,
          at: new Date().toISOString(),
          details: inputText || 'Extracted via voice transcription & Gemini understanding',
        },
      ],
    });

    onClose();
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-2">
          <h2>Drop Anything</h2>
          <button className="text-gray-400 hover:text-navy text-2xl font-bold" onClick={onClose}>
            ×
          </button>
        </div>
        <p className="hand text-lg mb-4">“You share. I find the Knots.”</p>

        {/* Drop Quick Mode Buttons */}
        <div className="flex gap-2 flex-wrap mb-3">
          <button
            type="button"
            className="chip active"
            onClick={() => {
              setInputText('');
              setFilePreview(null);
              setIsVoiceSource(false);
              setTranscriptPreview(null);
              setVoiceError(null);
            }}
          >
            ✎ Text / Message
          </button>

          {/* Voice Input Button */}
          <button
            type="button"
            className={`chip font-semibold transition-all ${
              isRecording
                ? 'bg-red-100 border-red-500 text-red-700 ring-2 ring-red-400'
                : voiceState === 'processing'
                ? 'bg-purple-100 border-purple-400 text-purple-800'
                : ''
            }`}
            onClick={isRecording ? handleStopVoice : handleStartVoice}
          >
            {isRecording
              ? `⏹ Stop Recording (${formatSeconds(recordingSeconds)})`
              : voiceState === 'processing'
              ? '⌛ Processing voice…'
              : '◉ Voice Input'}
          </button>

          <button
            type="button"
            className="chip"
            onClick={() => {
              setIsVoiceSource(true);
              const testVoice = 'Sid will send me the PPT by October 2';
              setInputText(testVoice);
              setTranscriptPreview(testVoice);
              executeAnalysis(testVoice, undefined, undefined, 'Voice');
            }}
          >
            Voice Test: Sid PPT by Oct 2
          </button>

          <button
            type="button"
            className="chip"
            onClick={() => {
              setIsVoiceSource(false);
              setInputText('Venkat: "I\'ll submit the PDF by Oct 2."');
            }}
          >
            Example: Venkat PDF
          </button>

          <button
            type="button"
            className="chip"
            onClick={() => {
              setIsVoiceSource(false);
              setInputText('Sid: "Here is the PPT. I just sent the presentation slides."');
            }}
          >
            Example: Sid sent PPT (Resolution)
          </button>
        </div>

        {/* Clear Voice States Banner */}
        {voiceState === 'requesting' && (
          <div className="p-3 mb-3 bg-purple-50 border border-purple-200 rounded-xl text-sm font-semibold flex items-center gap-2 text-purple-900">
            <span className="animate-spin text-purple-600">●</span>
            <span>Requesting microphone permission…</span>
          </div>
        )}

        {isRecording && (
          <div className="p-3 mb-3 bg-red-50 border border-red-300 rounded-xl text-sm font-semibold flex items-center justify-between text-red-900 animate-pulse">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-600 animate-ping"></span>
              <span>Listening… speak your thought or promise ({formatSeconds(recordingSeconds)})</span>
            </div>
            <button
              type="button"
              className="btn danger text-xs py-1 px-3"
              onClick={handleStopVoice}
            >
              Stop Recording ⏹
            </button>
          </div>
        )}

        {voiceState === 'processing' && (
          <div className="p-3 mb-3 bg-purple-50 border border-purple-300 rounded-xl text-sm font-semibold flex items-center justify-between text-purple-900">
            <div className="flex items-center gap-2">
              <span className="text-xl animate-spin">✦</span>
              <span>Processing voice… transcribing via Hugging Face Whisper & analyzing Knots</span>
            </div>
          </div>
        )}

        {/* Understandable Microphone / API Errors with Retry */}
        {voiceError && (
          <div className="p-3 mb-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-red-600 font-bold">⚠</span>
              <span>{voiceError}</span>
            </div>
            <button
              type="button"
              className="text-xs bg-red-100 hover:bg-red-200 text-red-900 font-bold px-3 py-1 rounded-lg border border-red-300"
              onClick={handleStartVoice}
            >
              Retry Voice 🔄
            </button>
          </div>
        )}

        {/* Transcript Preview */}
        {transcriptPreview && (
          <div className="p-3 mb-3 bg-green-50 border border-green-200 rounded-xl text-xs text-green-900 flex items-center justify-between">
            <div>
              <b className="block text-green-800">Transcript preview (Voice):</b>
              <span className="italic">“{transcriptPreview}”</span>
            </div>
            <span className="pill resolved text-[10px]">Transcribed ✓</span>
          </div>
        )}

        <div className="field">
          <label>Message, spoken thought, or note</label>
          <textarea
            rows={3}
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value);
              if (!e.target.value) setIsVoiceSource(false);
            }}
            placeholder="Paste chat message, spoken thought (e.g. 'Sid will send me the PPT by October 2'), or describe what happened..."
          />
        </div>

        <div className="field">
          <label>Screenshot / Receipt / Document</label>
          <div
            className="dropzone"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) {
                setSelectedFile(f);
                setIsVoiceSource(false);
                if (f.type.startsWith('image/')) {
                  const reader = new FileReader();
                  reader.onload = () => setFilePreview(reader.result as string);
                  reader.readAsDataURL(f);
                }
              }
            }}
          >
            <b>Drag & drop a screenshot here</b>
            <br />
            <small className="text-gray-500">
              or click to choose image / receipt — Gemini reads chat header contact & commitments
            </small>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*,.pdf"
              className="hidden"
              onChange={handleFileChange}
            />

            {filePreview && (
              <div className="mt-3">
                <img src={filePreview} alt="Screenshot preview" className="preview-img mx-auto" />
                <p className="text-xs text-green-700 mt-2 font-semibold">Screenshot ready for Gemini Multimodal reading ✓</p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 flex justify-between items-center">
          <button
            type="button"
            className="btn soft"
            onClick={handleAnalyze}
            disabled={isAnalyzing || isRecording}
          >
            {isAnalyzing ? 'Reading context & finding Knots...' : 'Find the Knots ✦'}
          </button>
        </div>

        {/* Extracted Card Confirmation / Resolution */}
        {extracted && (
          <div className="mt-5 p-4 rounded-2xl bg-[#f4efff] border border-[#dcd4ff] text-sm">
            <div className="flex justify-between items-start mb-2">
              <div>
                <b className="text-base text-navy">
                  {extracted.resolutionDetected ? 'Possible Resolution Found' : 'THREAD Detected a Knot'}
                </b>
                <p className="text-xs text-muted">
                  Confidence: <span className="font-semibold text-purple-800">{extracted.confidence}</span> · Source:{' '}
                  <span className="font-semibold">{isVoiceSource ? 'Voice' : extracted.source}</span>
                </p>
              </div>
              <span className={`pill ${extracted.resolutionDetected ? 'resolved' : 'waiting'}`}>
                {extracted.resolutionDetected ? 'RESOLUTION PROPOSED' : extracted.status}
              </span>
            </div>

            {extracted.resolutionDetected ? (
              <div className="bg-white p-3 rounded-xl border border-green-200 my-2">
                <p className="font-bold text-green-900 mb-1">
                  Does this resolve “{extracted.possibleResolutionTitle || extracted.title}”?
                </p>
                <p className="text-xs text-gray-700">{extracted.resolutionEvidence}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 my-3 bg-white p-3 rounded-xl border border-gray-100">
                <div>
                  <span className="text-xs text-gray-500 block">Title</span>
                  <input
                    className="font-bold w-full border-b border-gray-200 outline-none py-1"
                    value={extracted.title}
                    onChange={(e) => setExtracted({ ...extracted, title: e.target.value })}
                  />
                </div>
                <div>
                  <span className="text-xs text-gray-500 block">Contact / Person</span>
                  <input
                    className="font-bold w-full border-b border-gray-200 outline-none py-1"
                    value={extracted.person || ''}
                    placeholder="e.g. Sid, Venkat"
                    onChange={(e) => setExtracted({ ...extracted, person: e.target.value, waitingOn: e.target.value })}
                  />
                </div>
                <div>
                  <span className="text-xs text-gray-500 block">Type</span>
                  <select
                    className="w-full text-xs font-semibold py-1 outline-none border-b border-gray-200"
                    value={extracted.type}
                    onChange={(e) => setExtracted({ ...extracted, type: e.target.value as any })}
                  >
                    <option value="COMMITMENT">Commitment</option>
                    <option value="DEADLINE">Deadline</option>
                    <option value="WAITING">Waiting</option>
                    <option value="LENT_ITEM">Lent Item</option>
                    <option value="REFUND">Refund</option>
                    <option value="APPLICATION">Application</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <span className="text-xs text-gray-500 block">Status</span>
                  <select
                    className="w-full text-xs font-semibold py-1 outline-none border-b border-gray-200"
                    value={extracted.status}
                    onChange={(e) => setExtracted({ ...extracted, status: e.target.value as any })}
                  >
                    <option value="WAITING">Waiting</option>
                    <option value="OPEN">Open</option>
                    <option value="RESOLVED">Resolved</option>
                  </select>
                </div>
                <div>
                  <span className="text-xs text-gray-500 block">Waiting on</span>
                  <span className="font-semibold text-navy">{extracted.waitingOn || extracted.person || 'You'}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 block">Expected Date</span>
                  <input
                    type="date"
                    className="w-full text-xs font-semibold py-1 outline-none"
                    value={extracted.expectedDate || ''}
                    onChange={(e) => setExtracted({ ...extracted, expectedDate: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <span className="text-xs text-gray-500 block">Thread</span>
                  <select
                    className="w-full text-xs py-1 border-b border-gray-200 outline-none"
                    value={extracted.threadTitle}
                    onChange={(e) => setExtracted({ ...extracted, threadTitle: e.target.value })}
                  >
                    {threads.map((t) => (
                      <option key={t.id} value={t.title}>
                        {t.title}
                      </option>
                    ))}
                    <option value="Promptothon">Promptothon</option>
                    <option value="Commitments">Commitments</option>
                    <option value="Personal">Personal</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <span className="text-xs text-gray-500 block">Next action</span>
                  <input
                    className="w-full text-xs text-gray-700 border-b border-gray-200 outline-none py-1"
                    value={extracted.nextAction}
                    onChange={(e) => setExtracted({ ...extracted, nextAction: e.target.value })}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 mt-3">
              <button type="button" className="btn alt" onClick={() => setExtracted(null)}>
                Cancel
              </button>
              <button type="submit" className="btn" onClick={handleConfirmSave}>
                {extracted.resolutionDetected ? 'Confirm Resolution ✓' : 'Add to my THREAD'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
