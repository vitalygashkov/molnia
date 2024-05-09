const DEFAULT_STATE = {
  total: 0,
  current: 0,
  chunkSize: 0,
  chunkSizes: [],
  averageSize: 0,
  averageTotal: 0,
  speed: { bps: 0 },
};

const formatSeconds = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  const hourString = hours > 0 ? `${hours}h` : '';
  const minuteString = minutes > 0 ? `${minutes}m` : '';
  const secondString = remainingSeconds > 0 ? `${remainingSeconds}s` : '';
  if (hours > 0) {
    return `${hourString} ${minuteString || '0m'} ${secondString && `${secondString}`}`;
  } else if (!hours && minutes > 0) {
    return `${minuteString} ${secondString && `${secondString}`}`;
  }
  return secondString;
};

const createProgress = (count = 0) => {
  const state = { ...DEFAULT_STATE };
  let secondsPassed = 0;
  const interval = setInterval(() => {
    if (secondsPassed > 1) state.speed.bps = state.current / secondsPassed;
    secondsPassed += 0.5;
  }, 500);

  return {
    state,
    increase(size) {
      state.current += size;
      state.chunkSize = size;
      state.chunkSizes.push(size);
      state.averageSize = state.current / state.chunkSizes;
      state.averageTotal = count * state.averageSize;
    },
    stop() {
      clearInterval(interval);
      Object.assign(state, DEFAULT_STATE);
    },
    toString() {
      const currentMb = state.current / 1024 / 1024;
      const currentMbRounded = currentMb.toFixed(1);
      const total = state.total / 1024 / 1024;
      const totalRounded = total.toFixed(1);
      const speed = state.speed.bps / 1024 / 1024;
      const speedRounded = speed.toFixed(1);

      let message = `Progress – `;

      if (state.total || state.averageTotal) {
        const bytesElapsed = state.speed.bps * secondsPassed;
        const bytesLeft = (state.total || state.averageTotal) - bytesElapsed;
        const secondsLeft = Math.round(bytesLeft / state.speed.bps);
        const secondsText = formatSeconds(secondsLeft);
        if (secondsLeft && isFinite(secondsLeft) && secondsText)
          message = `${secondsText} left – `;
      }

      message += `${currentMbRounded}`;
      if (state.total) message += ` of ${totalRounded} MB`;
      else message += ' MB';
      if (state.speed.bps) message += ` (${speedRounded} MB/sec)`;

      return message;
    },
  };
};

module.exports = { createProgress };
