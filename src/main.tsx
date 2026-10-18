import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { RecordingWorkspace } from './app/RecordingWorkspace';
import { recordingBinding } from './app/recordingBinding';
import './ui/styles.css';
const legacy = new URLSearchParams(window.location.search).get('view') === 'simulation';
createRoot(document.getElementById('root')!).render(<React.StrictMode>{legacy ? <><a href="/" style={{ color: '#53e5cb', margin: 24, display: 'inline-block' }}>← Kayıt geliştirme alanı</a><App /></> : <RecordingWorkspace binding={recordingBinding}/>}</React.StrictMode>);
