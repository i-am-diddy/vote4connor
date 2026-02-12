// ==UserScript==
// @name         Connor Gutierrez Auto-voter
// @namespace    https://github.com/i-am-diddy/vote4connor/
// @version      6.7
// @description  Auto-votes Connor Gutierrez on EPTimes
// @author       I-am-diddy
// @match        https://www.elpasotimes.com/story/sports/high-school/2026/02/10/vote-el-paso-childrens-hospital-hs-male-athlete-for-feb-3-7/88578099007/*
// @match        https://www.usatodaynetworkservice.com/tangstatic/html/ptx1/*
// @grant        none
// @license	 MIT
// ==/UserScript==

(function() {
    'use strict';

    // Check if we're inside the iframe
    if (window.location.href.includes('usatodaynetworkservice.com')) {
        console.log('Running inside voting iframe');

        function vote() {
            // Find all radio buttons
            const radioButtons = document.querySelectorAll('input[type="radio"]');
            console.log('Found', radioButtons.length, 'radio buttons');

            if (radioButtons.length < 3) {
                console.log('Waiting for radio buttons to load...');
                return false;
            }

            // Click the 3rd radio button (index 2)
            const radioButton = radioButtons[2];

            if (!radioButton.checked) {
                radioButton.click();
                console.log('Clicked 3rd radio button');
            }

            // Wait then click vote button
            setTimeout(function() {
                const voteButton = document.querySelector('button[id*="vote-button"]') ||
                                  document.querySelector('button[type="submit"]') ||
                                  document.querySelector('button');

                if (voteButton) {
                    console.log('Clicking vote button:', voteButton.textContent);
                    voteButton.click();
                    console.log('Vote button clicked!');

                    // Wait 0.5 seconds AFTER clicking vote before telling parent to reload
                    setTimeout(function() {
                        console.log('Telling parent to reload now...');
                        try {
                            window.top.postMessage('VOTE_COMPLETE', '*');
                        } catch (e) {
                            console.log('Could not notify parent:', e);
                        }
                    }, 500);
                } else {
                    console.log('Vote button not found');
                }
            }, 1000);

            return true;
        }

        // Use multiple events to ensure we catch when content is ready
        function startVoting() {
            let attempts = 0;
            const maxAttempts = 5;

            function tryVote() {
                attempts++;
                console.log('Vote attempt', attempts, 'of', maxAttempts);

                const success = vote();

                if (!success && attempts < maxAttempts) {
                    // Retry after 1.5 seconds if voting failed
                    setTimeout(tryVote, 1500);
                } else if (!success) {
                    console.log('Failed after', maxAttempts, 'attempts. Telling parent to reload...');
                    try {
                        window.top.postMessage('RELOAD_NEEDED', '*');
                    } catch (e) {
                        console.log('Could not notify parent:', e);
                    }
                }
            }

            // Start trying after a longer delay
            setTimeout(tryVote, 3000);
        }

        // Try multiple load events
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', startVoting);
        } else {
            // DOM already loaded
            startVoting();
        }

    } else {
        // We're on the main page
        console.log('Running on main page, waiting for vote submission...');

        // Listen for messages from iframe
        window.addEventListener('message', function(event) {
            if (event.data === 'VOTE_COMPLETE' || event.data === 'RELOAD_NEEDED') {
                console.log('Received reload signal from iframe:', event.data);
                console.log('Reloading now...');
                location.reload();
            }
        });
    }
})();
