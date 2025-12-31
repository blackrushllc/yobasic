// Chat manager for YoBASIC using Supabase
(function(global) {
    'use strict';

    let guestIp = null;
    const notificationSound = new Audio('media/alert.mp3');
    notificationSound.load();

    function playNotificationSound() {
        notificationSound.currentTime = 0;
        notificationSound.play().catch(e => {
            if (e.name !== 'NotAllowedError') console.warn('[Chat] Audio play failed:', e);
        });
    }

    async function getHandle() {
        if (global.Identity && global.Identity.isLoggedIn()) {
            const user = global.Identity.getCurrentUser();
            return user.username;
        }
        if (!guestIp) {
            try {
                const response = await fetch('https://api.ipify.org?format=json');
                const data = await response.json();
                guestIp = data.ip;
            } catch (e) {
                console.error('[Chat] Failed to fetch IP:', e);
                guestIp = 'Guest';
            }
        }
        return guestIp;
    }

    function stringToColor(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        // Use HSL for better control over brightness and contrast
        // Hue: 0-360, Saturation: 70-100%, Lightness: 60-80%
        const h = Math.abs(hash) % 360;
        const s = 80 + (Math.abs(hash) % 20); // 80-100%
        const l = 65 + (Math.abs(hash) % 15); // 65-80%
        return `hsl(${h}, ${s}%, ${l}%)`;
    }


    let supabaseInstance = null;
    let currentChannel = null;
    let refreshInterval = null;

    async function initChat() {
        if (!supabaseInstance) {
            supabaseInstance = await global.getSupabase();
        }
        const supabase = supabaseInstance;
        
        if (!supabase) {
            console.warn('[Chat] Supabase not available, chat disabled.');
            return;
        }

        const messagesContainer = document.getElementById('chat-messages');
        let chatInput = document.getElementById('chat-input');
        const chatSend = document.getElementById('chat-send');

        if (!messagesContainer || !chatInput || !chatSend) {
            console.warn('[Chat] Chat UI elements not found.');
            return;
        }

        const knownIds = new Set();
        const mySentIds = new Set();
        let isFirstLoad = true;

        if (refreshInterval) clearInterval(refreshInterval);
        if (currentChannel) currentChannel.unsubscribe();

        async function loadComments() {
            // If the container is no longer in the DOM, stop refreshing
            if (!document.body.contains(messagesContainer)) {
                if (refreshInterval) clearInterval(refreshInterval);
                return;
            }

            const { data, error } = await supabase
                .from('comments')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) {
                console.error('[Chat] Error loading comments:', error);
                return;
            }

            if (data) {
                let hasNewForeignMessage = false;
                const myHandle = await getHandle();

                data.forEach(comment => {
                    if (!knownIds.has(comment.id)) {
                        if (!isFirstLoad && !mySentIds.has(comment.id) && comment.handle !== myHandle) {
                            hasNewForeignMessage = true;
                        }
                        knownIds.add(comment.id);
                    }
                });

                if (hasNewForeignMessage) {
                    playNotificationSound();
                }
                const forceScroll = isFirstLoad;
                isFirstLoad = false;
                renderComments([...data].reverse(), forceScroll);
            }
        }

        function renderComments(comments, forceScroll = false) {
            const wasAtBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop <= messagesContainer.clientHeight + 50;
            
            messagesContainer.innerHTML = '';
            const currentUser = global.Identity && global.Identity.getCurrentUser && global.Identity.getCurrentUser();
            
            comments.forEach(comment => {
                const div = document.createElement('div');
                div.className = 'chat-message mb-1';
                div.style.wordBreak = 'break-word';
                
                const color = stringToColor(comment.handle);

                const handleSpan = document.createElement('span');
                handleSpan.className = 'fw-bold me-1';
                handleSpan.style.color = color;
                handleSpan.textContent = comment.handle + ':';
                
                const contentSpan = document.createElement('span');
                contentSpan.style.whiteSpace = 'pre-wrap';
                contentSpan.style.color = color;
                contentSpan.textContent = comment.content;
                
                div.appendChild(handleSpan);
                div.appendChild(contentSpan);

                // Show "Open in IDE" button if content has more than one line
                const lines = comment.content.split('\n');
                if (lines.length > 1) {
                    const openBtn = document.createElement('button');
                    openBtn.className = 'btn btn-link btn-sm text-info p-0 ms-2';
                    openBtn.style.textDecoration = 'none';
                    openBtn.style.lineHeight = '1';
                    openBtn.innerHTML = 'Open';
                    openBtn.title = 'Open in IDE';
                    openBtn.onclick = () => {
                        if (global.YoBasicIDE && global.YoBasicIDE.openExample) {
                            global.YoBasicIDE.openExample({
                                files: [{
                                    name: "CHAT_CODE.BAS",
                                    language: "basic",
                                    role: "main",
                                    content: comment.content
                                }]
                            });
                        } else {
                            console.warn('[Chat] YoBasicIDE.openExample not available');
                        }
                    };
                    div.appendChild(openBtn);
                }
                
                // Show delete button if user can delete
                // 1. Users can delete their own comments (user_id matches)
                // 2. Anyone can delete comments that don't have a linked user (guest comments)
                const canDelete = !comment.user_id || (currentUser && currentUser.id === comment.user_id);
                
                if (canDelete) {
                    const deleteBtn = document.createElement('button');
                    deleteBtn.className = 'btn btn-link btn-sm text-danger p-0 ms-2';
                    deleteBtn.style.textDecoration = 'none';
                    deleteBtn.style.lineHeight = '1';
                    deleteBtn.innerHTML = '&times;';
                    deleteBtn.title = 'Delete comment';
                    deleteBtn.onclick = async () => {
                        if (confirm('Delete this comment?')) {
                            const { error: delErr } = await supabase.from('comments').delete().eq('id', comment.id);
                            if (delErr) {
                                console.error('[Chat] Delete failed:', delErr);
                                alert('Delete failed: ' + delErr.message);
                            } else {
                                // Refresh locally in case Realtime is slow/disabled
                                loadComments();
                            }
                        }
                    };
                    div.appendChild(deleteBtn);
                }

                messagesContainer.appendChild(div);
            });
            
            if (wasAtBottom || forceScroll) {
                setTimeout(() => {
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                }, 50);
            }
        }

        async function sendComment() {
            const content = chatInput.value.trim();
            if (!content) return;

            chatInput.value = '';
            const handle = await getHandle();
            const user = global.Identity && global.Identity.getCurrentUser && global.Identity.getCurrentUser();

            const { data: insertedData, error } = await supabase
                .from('comments')
                .insert({
                    handle: handle,
                    content: content,
                    user_id: user ? user.id : null
                })
                .select();

            if (error) {
                console.error('[Chat] Error sending comment:', error);
                alert('Could not send comment: ' + error.message);
            } else {
                if (insertedData && insertedData[0]) {
                    mySentIds.add(insertedData[0].id);
                    knownIds.add(insertedData[0].id);
                }
                // Refresh locally in case Realtime is slow/disabled
                loadComments();
            }
        }

        chatSend.onclick = sendComment;
        const handleKeyDown = (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendComment();
            }
        };
        chatInput.onkeydown = handleKeyDown;

        chatInput.ondblclick = () => {
            if (chatInput.tagName === 'TEXTAREA') return;

            const textarea = document.createElement('textarea');
            textarea.id = 'chat-input';
            textarea.className = 'form-control bg-dark text-light border-secondary';
            textarea.placeholder = 'Type a message...';
            textarea.value = chatInput.value;
            textarea.style.height = '100px';
            textarea.style.fontSize = '0.9rem';

            textarea.onkeydown = handleKeyDown;

            chatInput.parentNode.replaceChild(textarea, chatInput);
            chatInput = textarea;
            chatInput.focus();
        };

        // Real-time subscription
        currentChannel = supabase
            .channel('public:comments')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments' }, () => {
                loadComments();
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'comments' }, () => loadComments())
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'comments' }, () => loadComments())
            .subscribe();

        // Initial load
        loadComments();
        
        // Periodic refresh (fallback if Realtime is disabled)
        refreshInterval = setInterval(loadComments, 5000);
        
        // Expose refresh
        global.Chat.refresh = loadComments;
    }

    global.Chat = { init: initChat };

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
