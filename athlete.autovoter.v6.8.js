// ==UserScript==
// @name         athlete of the week
// @namespace    https://github.com/i-am-diddy/vote4connor/
// @version      6.8
// @description  Auto-votes on EPTimes. Press Ctrl+Shift+K to choose who to vote for.
// @author       i-am-diddy
// @match        https://www.elpasotimes.com/story/sports/high-school/*
// @match        https://www.usatodaynetworkservice.com/tangstatic/html/ptx1/*
// @grant        GM_setValue
// @grant        GM_getValue
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    const STORAGE_KEY = 'autovoter_selected_index';

    // ─── IFRAME CONTEXT ───────────────────────────────────────────────────────
    if (window.location.href.includes('usatodaynetworkservice.com')) {
        console.log('[AutoVoter] Running inside voting iframe');

        // Listen for a request from the parent to send back candidate list
        window.addEventListener('message', function(event) {
            if (event.data === 'REQUEST_CANDIDATES') {
                sendCandidates();
            }
            if (typeof event.data === 'object' && event.data.type === 'SET_CANDIDATE_INDEX') {
                const idx = event.data.index;
                try { GM_setValue(STORAGE_KEY, idx); } catch(e) { localStorage.setItem(STORAGE_KEY, idx); }
                console.log('[AutoVoter] Candidate index set to', idx);
            }
        });

        function getSelectedIndex() {
            try { return GM_getValue(STORAGE_KEY, null); } catch(e) { return localStorage.getItem(STORAGE_KEY); }
        }

        function getCandidates() {
            const radios = document.querySelectorAll('input[type="radio"]');
            return Array.from(radios).map((r, i) => {
                // Try to find an associated label
                let label = '';
                if (r.id) {
                    const lbl = document.querySelector(`label[for="${r.id}"]`);
                    if (lbl) label = lbl.textContent.trim();
                }
                if (!label) {
                    // Walk siblings / parent for text
                    const parent = r.closest('label') || r.parentElement;
                    if (parent) label = parent.textContent.trim();
                }
                return label || `Option ${i + 1}`;
            });
        }

        function sendCandidates() {
            const radios = document.querySelectorAll('input[type="radio"]');
            if (radios.length === 0) {
                setTimeout(sendCandidates, 500);
                return;
            }
            const candidates = getCandidates();
            try {
                window.top.postMessage({ type: 'CANDIDATES_LIST', candidates }, '*');
            } catch(e) {
                console.log('[AutoVoter] Could not send candidates to parent:', e);
            }
        }

        function vote() {
            const radioButtons = document.querySelectorAll('input[type="radio"]');
            console.log('[AutoVoter] Found', radioButtons.length, 'radio buttons');

            if (radioButtons.length === 0) {
                console.log('[AutoVoter] Waiting for radio buttons to load...');
                return false;
            }

            const selectedIndex = getSelectedIndex();

            if (selectedIndex === null || selectedIndex === undefined || selectedIndex === '') {
                console.log('[AutoVoter] No candidate selected yet. Press Ctrl+Shift+K on the main page to choose.');
                // Notify parent so they can prompt the user
                try { window.top.postMessage('NEEDS_SELECTION', '*'); } catch(e) {}
                return true; // stop retrying — wait for user to configure
            }

            const idx = parseInt(selectedIndex, 10);
            if (idx < 0 || idx >= radioButtons.length) {
                console.log('[AutoVoter] Saved index', idx, 'is out of range (', radioButtons.length, 'options). Prompting re-selection.');
                try { window.top.postMessage('NEEDS_SELECTION', '*'); } catch(e) {}
                return true;
            }

            const radioButton = radioButtons[idx];
            if (!radioButton.checked) {
                radioButton.click();
                console.log('[AutoVoter] Clicked radio button', idx, ':', getCandidates()[idx]);
            }

            setTimeout(function() {
                const voteButton = document.querySelector('button[id*="vote-button"]') ||
                                   document.querySelector('button[type="submit"]') ||
                                   document.querySelector('button');

                if (voteButton) {
                    console.log('[AutoVoter] Clicking vote button:', voteButton.textContent);
                    voteButton.click();
                    setTimeout(function() {
                        try { window.top.postMessage('VOTE_COMPLETE', '*'); } catch(e) {}
                    }, 500);
                } else {
                    console.log('[AutoVoter] Vote button not found');
                }
            }, 1000);

            return true;
        }

        function startVoting() {
            let attempts = 0;
            const maxAttempts = 5;

            function tryVote() {
                attempts++;
                console.log('[AutoVoter] Vote attempt', attempts, 'of', maxAttempts);
                const success = vote();
                if (!success && attempts < maxAttempts) {
                    setTimeout(tryVote, 1500);
                } else if (!success) {
                    console.log('[AutoVoter] Failed after', maxAttempts, 'attempts.');
                    try { window.top.postMessage('RELOAD_NEEDED', '*'); } catch(e) {}
                }
            }

            setTimeout(tryVote, 3000);
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', startVoting);
        } else {
            startVoting();
        }

    // ─── MAIN PAGE CONTEXT ────────────────────────────────────────────────────
    } else {
        console.log('[AutoVoter] Running on main page. Press Ctrl+Shift+K to select candidate.');

        function getSelectedIndex() {
            try { return GM_getValue(STORAGE_KEY, null); } catch(e) { return localStorage.getItem(STORAGE_KEY); }
        }

        function setSelectedIndex(idx) {
            try { GM_setValue(STORAGE_KEY, idx); } catch(e) { localStorage.setItem(STORAGE_KEY, idx); }
        }

        function getIframe() {
            return document.querySelector('iframe[src*="usatodaynetworkservice.com"]') ||
                   document.querySelector('iframe[src*="tangstatic"]') ||
                   document.querySelector('iframe');
        }

        // ── Candidate selection UI ──
        function showCandidateSelector(candidates) {
            // Remove any existing UI
            const existing = document.getElementById('autovoter-modal');
            if (existing) existing.remove();

            const currentIdx = getSelectedIndex();

            const overlay = document.createElement('div');
            overlay.id = 'autovoter-modal';
            overlay.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.6); z-index: 999999;
                display: flex; align-items: center; justify-content: center;
                font-family: sans-serif;
            `;

            const box = document.createElement('div');
            box.style.cssText = `
                background: #1e1e2e; color: #cdd6f4; border-radius: 12px;
                padding: 28px 32px; min-width: 340px; max-width: 500px;
                box-shadow: 0 8px 40px rgba(0,0,0,0.6);
            `;

            box.innerHTML = `
                <h2 style="margin:0 0 6px;font-size:18px;color:#cba6f7;">🗳️ AutoVoter — Select Candidate</h2>
                <p style="margin:0 0 18px;font-size:13px;color:#a6adc8;">
                    Choose who to vote for. This will be remembered until you change it.<br>
                    <kbd style="background:#313244;padding:2px 6px;border-radius:4px;font-size:12px;">Ctrl+Shift+K</kbd> to reopen this menu.
                </p>
                <div id="autovoter-candidates" style="display:flex;flex-direction:column;gap:8px;"></div>
                <div style="margin-top:20px;display:flex;gap:10px;justify-content:flex-end;">
                    <button id="autovoter-cancel" style="background:#313244;color:#cdd6f4;border:none;padding:8px 18px;border-radius:7px;cursor:pointer;font-size:14px;">Cancel</button>
                    <button id="autovoter-save" style="background:#cba6f7;color:#1e1e2e;border:none;padding:8px 18px;border-radius:7px;cursor:pointer;font-size:14px;font-weight:bold;">Save & Apply</button>
                </div>
            `;

            overlay.appendChild(box);
            document.body.appendChild(overlay);

            const container = document.getElementById('autovoter-candidates');
            let selectedIdx = currentIdx !== null ? parseInt(currentIdx, 10) : null;

            candidates.forEach((name, i) => {
                const btn = document.createElement('button');
                btn.textContent = `${i + 1}. ${name}`;
                btn.dataset.index = i;
                btn.style.cssText = `
                    background: ${i === selectedIdx ? '#45475a' : '#313244'};
                    color: ${i === selectedIdx ? '#cba6f7' : '#cdd6f4'};
                    border: 2px solid ${i === selectedIdx ? '#cba6f7' : 'transparent'};
                    padding: 10px 14px; border-radius: 8px; cursor: pointer;
                    text-align: left; font-size: 14px; transition: all 0.15s;
                `;
                btn.addEventListener('click', function() {
                    selectedIdx = i;
                    container.querySelectorAll('button').forEach(b => {
                        b.style.background = '#313244';
                        b.style.color = '#cdd6f4';
                        b.style.borderColor = 'transparent';
                    });
                    btn.style.background = '#45475a';
                    btn.style.color = '#cba6f7';
                    btn.style.borderColor = '#cba6f7';
                });
                container.appendChild(btn);
            });

            document.getElementById('autovoter-cancel').addEventListener('click', () => overlay.remove());

            document.getElementById('autovoter-save').addEventListener('click', function() {
                if (selectedIdx === null) {
                    alert('Please select a candidate first.');
                    return;
                }
                setSelectedIndex(selectedIdx);
                // Also tell the iframe directly
                const iframe = getIframe();
                if (iframe && iframe.contentWindow) {
                    try {
                        iframe.contentWindow.postMessage({ type: 'SET_CANDIDATE_INDEX', index: selectedIdx }, '*');
                    } catch(e) {}
                }
                overlay.remove();
                console.log('[AutoVoter] Candidate set to index', selectedIdx, ':', candidates[selectedIdx]);

                // Show brief confirmation
                const toast = document.createElement('div');
                toast.textContent = `✅ Now voting for: ${candidates[selectedIdx]}`;
                toast.style.cssText = `
                    position:fixed;bottom:24px;right:24px;background:#a6e3a1;color:#1e1e2e;
                    padding:12px 20px;border-radius:10px;font-family:sans-serif;
                    font-size:14px;font-weight:bold;z-index:999999;
                    box-shadow:0 4px 20px rgba(0,0,0,0.3);
                `;
                document.body.appendChild(toast);
                setTimeout(() => toast.remove(), 3500);
            });

            // Close on overlay click
            overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
        }

        function requestCandidatesAndShow() {
            const iframe = getIframe();
            if (!iframe || !iframe.contentWindow) {
                alert('[AutoVoter] Could not find the voting iframe. Make sure the poll is visible on the page.');
                return;
            }
            // Request candidates from iframe
            iframe.contentWindow.postMessage('REQUEST_CANDIDATES', '*');
        }

        // ── Keyboard shortcut ──
        document.addEventListener('keydown', function(e) {
            if (e.ctrlKey && e.shiftKey && e.key === 'K') {
                e.preventDefault();
                requestCandidatesAndShow();
            }
        });

        // ── Message listener ──
        window.addEventListener('message', function(event) {
            if (event.data === 'VOTE_COMPLETE' || event.data === 'RELOAD_NEEDED') {
                console.log('[AutoVoter] Received reload signal:', event.data);
                location.reload();
            }

            if (event.data === 'NEEDS_SELECTION') {
                console.log('[AutoVoter] Iframe says no candidate selected — opening selector.');
                // Give iframe a moment to render candidates
                setTimeout(requestCandidatesAndShow, 500);
            }

            if (typeof event.data === 'object' && event.data.type === 'CANDIDATES_LIST') {
                showCandidateSelector(event.data.candidates);
            }
        });
    }
})();