// Local wrapper around vendored @nuintun/qrcode (esm build) present in libs/@nuintun/qrcode
import { Encoder, Decoder, Byte, grayscale, binarize, Detector } from './@nuintun/qrcode/esm/index.js';

function hexToRgb(hex: string): [number, number, number] {
	if (!hex) return [0, 0, 0];
	const clean = hex.replace('#', '');
	const bigint = parseInt(clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean, 16);
	const r = (bigint >> 16) & 255;
	const g = (bigint >> 8) & 255;
	const b = bigint & 255;
	return [r, g, b];
}

const QR = {
	// Options shape kept similar to original usage in the app.
	async Encode(options: { text: string; width?: number; height?: number; correctLevel?: 'L'|'M'|'Q'|'H'; color?: { dark?: string; light?: string } }) {
		const { text, width = 320, height = 320, correctLevel = 'M', color = {} } = options as any;
		const encoder = new Encoder({ level: correctLevel });
		// Create a Byte segment for arbitrary text
		const encoded = encoder.encode(new Byte(text));
		const matrixSize = encoded.size;
		// Encoded.toDataURL(moduleSize, { margin, foreground, background }) expects moduleSize
		// totalPixel = moduleSize * matrixSize + margin * 2, default margin = moduleSize * 4
		// so totalPixel = moduleSize * (matrixSize + 8)
		const maxPixel = Math.min(width, height) || 320;
		let moduleSize = Math.max(1, Math.floor(maxPixel / (matrixSize + 8)));
		// produce GIF data URL
		const dataUrl = encoded.toDataURL(moduleSize, {
			foreground: hexToRgb(color.dark || '#000000'),
			background: hexToRgb(color.light || '#FFFFFF'),
		});
		return dataUrl;
	},

	async Decode(target: HTMLCanvasElement | HTMLImageElement) {
		// Accept either a Canvas or Image element
		let canvas: HTMLCanvasElement | null = null;
		if ((target as HTMLCanvasElement).getContext) {
			canvas = target as HTMLCanvasElement;
		} else {
			const img = target as HTMLImageElement;
			canvas = document.createElement('canvas');
			canvas.width = img.naturalWidth || img.width;
			canvas.height = img.naturalHeight || img.height;
			const ctx = canvas.getContext('2d', { willReadFrequently: true });
			if (!ctx) throw new Error('cannot-get-canvas-context');
			ctx.drawImage(img, 0, 0);
		}

		const ctx = canvas.getContext('2d', { willReadFrequently: true });
		if (!ctx) throw new Error('cannot-get-canvas-context');
		const { width, height } = canvas;
		const imageData = ctx.getImageData(0, 0, width, height);
		const luminances = grayscale(imageData);
		const bin = binarize(luminances, width, height);
		const detector = new Detector();
		for (const detected of detector.detect(bin)) {
			try {
				const decoder = new Decoder();
				const decoded = decoder.decode(detected.matrix);
				return decoded.content;
			} catch (e) {
				// try next detection
			}
		}
		throw new Error('QR code not found');
	}
};

export default QR;