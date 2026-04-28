class EdgeService {
  calculateEntropy(buffer) {
    if (!buffer?.length) return 0;

    const frequencies = new Array(256).fill(0);
    for (const byte of buffer) {
      frequencies[byte] += 1;
    }

    let entropy = 0;
    for (const count of frequencies) {
      if (!count) continue;
      const probability = count / buffer.length;
      entropy -= probability * Math.log2(probability);
    }

    return entropy;
  }

  countMatchesInSample(buffer, matcher, sampleSize = 32768) {
    if (!buffer?.length) return 0;
    const sample = buffer.subarray(0, Math.min(buffer.length, sampleSize)).toString('latin1');
    const matches = sample.match(matcher);
    return matches ? matches.length : 0;
  }

  extractMetadataSignals(buffer, mimeType = 'image/jpeg') {
    if (!buffer?.length) {
      return {
        score: 0,
        flags: [],
        metrics: {
          has_embedded_metadata: false,
          marker_count: 0,
          chunk_count: 0
        }
      };
    }

    const headerSample = buffer.subarray(0, Math.min(buffer.length, 32768)).toString('latin1');
    const flags = [];
    let score = 0;
    let markerCount = 0;
    let chunkCount = 0;
    let hasEmbeddedMetadata = false;

    if (mimeType === 'image/jpeg') {
      const exifPresent = headerSample.includes('Exif');
      const xmpPresent = headerSample.includes('http://ns.adobe.com/xap/1.0/');
      const jfifPresent = headerSample.includes('JFIF');
      markerCount = this.countMatchesInSample(buffer, /\u00ff[\u00e0-\u00ef]/g);
      hasEmbeddedMetadata = exifPresent || xmpPresent || jfifPresent;

      if (!hasEmbeddedMetadata) {
        score += 5;
        flags.push('Image file is missing the common JPEG metadata markers often present in native camera or editor exports.');
      }

      if (markerCount === 0) {
        score += 4;
        flags.push('JPEG marker structure looks sparse for a naturally exported file.');
      } else if (markerCount === 1 && !exifPresent && !xmpPresent) {
        score += 2;
      }
    } else if (mimeType === 'image/png') {
      const ancillaryMatches = headerSample.match(/eXIf|tEXt|iTXt|zTXt|pHYs|gAMA/g) || [];
      chunkCount = ancillaryMatches.length;
      hasEmbeddedMetadata = ancillaryMatches.some((chunk) => ['eXIf', 'tEXt', 'iTXt', 'zTXt'].includes(chunk));

      if (!hasEmbeddedMetadata) {
        score += 4;
        flags.push('PNG file has no textual or EXIF ancillary chunks, which can happen after aggressive regeneration or stripping.');
      }

      if (chunkCount === 0) {
        score += 2;
      }
    } else if (mimeType === 'image/webp') {
      const exifPresent = headerSample.includes('EXIF');
      const xmpPresent = headerSample.includes('XMP');
      const iccpPresent = headerSample.includes('ICCP');
      chunkCount = [exifPresent, xmpPresent, iccpPresent].filter(Boolean).length;
      hasEmbeddedMetadata = exifPresent || xmpPresent || iccpPresent;

      if (!hasEmbeddedMetadata) {
        score += 4;
        flags.push('WEBP container does not expose EXIF, XMP, or ICC profile chunks.');
      }
    }

    return {
      score: Math.min(score, 18),
      flags,
      metrics: {
        has_embedded_metadata: hasEmbeddedMetadata,
        marker_count: markerCount,
        chunk_count: chunkCount
      }
    };
  }

  hasEmbeddedMetadata(buffer, mimeType) {
    return Boolean(this.extractMetadataSignals(buffer, mimeType).metrics?.has_embedded_metadata);
  }

  /**
   * Lightweight deterministic heuristics for encoded image anomalies.
   */
  detectCompressionNoise(buffer, mimeType = 'image/jpeg', options = {}) {
    if (!buffer?.length) {
      return { score: 0, flags: [] };
    }

    const sample = buffer.subarray(0, Math.min(buffer.length, 65536));
    const entropy = this.calculateEntropy(sample);
    const metadataSignal = this.extractMetadataSignals(buffer, mimeType);
    const hasMetadata = Boolean(metadataSignal.metrics?.has_embedded_metadata);
    const flags = [];
    let score = 0;

    if (entropy < 6.55) {
      score += 12;
      flags.push('Encoded image stream shows unusually low entropy for a natural camera photo.');
    } else if (entropy > 7.98) {
      score += 8;
      flags.push('Encoded image stream shows unusually uniform high entropy consistent with regenerated media.');
    }

    if (!options.ignoreMetadata && !hasMetadata && entropy > 7.85) {
      score += 4;
    }

    if (!options.ignoreMetadata && metadataSignal.score >= 6 && entropy < 6.7) {
      score += 3;
    }

    return {
      score: Math.min(score, 28),
      flags
    };
  }

  /**
   * Deterministic byte-distribution heuristic used as a weak supplemental signal.
   */
  detectFaceArtifacts(buffer) {
    if (!buffer?.length) {
      return { score: 0, flags: [] };
    }

    const sample = buffer.subarray(0, Math.min(buffer.length, 65536));
    let abruptTransitions = 0;

    for (let index = 1; index < sample.length; index += 1) {
      if (Math.abs(sample[index] - sample[index - 1]) > 96) {
        abruptTransitions += 1;
      }
    }

    const transitionRate = sample.length > 1 ? abruptTransitions / (sample.length - 1) : 0;
    if (transitionRate < 0.14 || transitionRate > 0.78) {
      return {
        score: 4,
        flags: ['Encoded image structure shows an atypical transition pattern compared with most camera photos.']
      };
    }

    return { score: 0, flags: [] };
  }
}

module.exports = new EdgeService();
