const createProgress = (count = 0) => {
  return {
    current: 0,
    chunkSize: 0,
    total: 0,
    chunkSizes: [],
    averageSize: 0,
    averageTotal: 0,
    increase(size) {
      this.current += size;
      this.chunkSize = size;
      this.chunkSizes.push(size);
      this.averageSize = this.current / this.chunkSizes;
      this.averageTotal = count * this.averageSize;
    },
    toString() {
      const currentMb = this.current / 1024 / 1024;
      const currentMbRounded = currentMb.toFixed(1);
      const total = this.total / 1024 / 1024;
      const totalRounded = total.toFixed(1);
      let message = `Downloading ${currentMbRounded}`;
      if (this.total) message += ` of ${totalRounded} MB`;
      else message += ' MB';
      return message;
    },
  };
};

module.exports = { createProgress };
