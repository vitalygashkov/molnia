const DEFAULT_STATE = {
  total: { b: 0, mb: 0 },
  current: { b: 0, mb: 0 },
  chunkSize: 0,
  chunkSizes: [],
  averageSize: { b: 0, mb: 0 },
  averageTotal: { b: 0, mb: 0 },
  speed: { bps: 0, mbps: 0 },
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
    if (secondsPassed > 1) state.speed.bps = state.current.b / secondsPassed;
    secondsPassed += 0.5;
  }, 500);

  return {
    state,
    increase(size) {
      state.current.b += size;
      state.current.mb = state.current.b / 1024 / 1024;
      state.total.mb = state.total / 1024 / 1024;
      state.speed.mbps = state.speed.bps / 1024 / 1024;
      state.chunkSize = size;
      state.chunkSizes.push(size);
      state.averageSize.b = state.current.b / state.chunkSizes.length;
      state.averageSize.mb = state.averageSize.b / 1024 / 1024;
      state.averageTotal.b = count * state.averageSize.b;
      state.averageTotal.mb = state.averageTotal.b / 1024 / 1024;
    },
    stop() {
      clearInterval(interval);
      Object.assign(state, DEFAULT_STATE);
    },
    toString() {
      let message = '';
      if (state.speed.bps) message += `${state.speed.mbps.toFixed(1)} MB/s – `;

      message += `${state.current.mb.toFixed(1)}`;
      if (state.total.b) message += ` of ${state.total.mb.toFixed(1)} MB`;
      else message += ' MB';

      const total = state.total.b || state.averageTotal.b;
      if (total) {
        const bytesElapsed = state.speed.bps * secondsPassed;
        const bytesLeft = total - bytesElapsed;
        const secondsLeft = Math.round(bytesLeft / state.speed.bps);
        const secondsText = formatSeconds(secondsLeft);
        if (secondsLeft && isFinite(secondsLeft) && secondsText)
          message += `, ${secondsText} left`;
      }

      return message;
    },
  };
};

module.exports = { createProgress };
