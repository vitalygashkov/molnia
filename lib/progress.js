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
      this.total += size;
      this.averageSize = this.current / this.chunkSizes;
      this.averageTotal = count * this.averageSize;
    },
    toString() {
      const currentMb = this.current / 1024 / 1024;
      const currentMbRounded = parseFloat(currentMb.toFixed(2));
      return `Downloading ${currentMbRounded} MB`;
    },
  };
};

module.exports = { createProgress };
