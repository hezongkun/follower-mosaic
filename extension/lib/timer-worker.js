// Timers in a worker keep ticking normally even when the tab is in the background.
onmessage = (e) => setTimeout(() => postMessage(e.data.id), e.data.ms);
