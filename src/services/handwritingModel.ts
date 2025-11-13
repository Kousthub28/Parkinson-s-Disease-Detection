type HandwritingType = 'spiral' | 'wave';
type HandwritingClass = 'Parkinsons' | 'Healthy';

interface ModelConfig {
	path: string;
	inputSize: number;
	description: string;
}

export interface HandwritingPrediction {
	label: HandwritingClass;
	confidence: number;
	probabilities: Record<HandwritingClass, number>;
	modelUsed: HandwritingType;
	summary: string;
}

const MODEL_CONFIG: Record<HandwritingType, ModelConfig> = {
	spiral: {
		path: '/models/spiral/model.json',
		inputSize: 224,
		description: 'MobileNetV2 base fine-tuned on spiral drawings',
	},
	wave: {
		path: '/models/wave/model.json',
		inputSize: 224,
		description: 'VGG16 base fine-tuned on wave drawings',
	},
};

let tfModule: typeof import('@tensorflow/tfjs') | null = null;
const modelCache: Partial<Record<HandwritingType, Promise<import('@tensorflow/tfjs').LayersModel>>> = {};

async function loadTensorflow() {
	if (!tfModule) {
		tfModule = await import('@tensorflow/tfjs');
		// use WebGL backend when available for better performance
		try {
					if (tfModule.getBackend() !== 'webgl') {
				await tfModule.setBackend('webgl');
				await tfModule.ready();
			}
		} catch (error) {
			console.warn('Unable to initialise WebGL backend for TensorFlow.js; falling back to default.', error);
		}
	}
	return tfModule;
}

async function loadModel(type: HandwritingType) {
	if (!modelCache[type]) {
		const tf = await loadTensorflow();
		const config = MODEL_CONFIG[type];
		modelCache[type] = tf
			.loadLayersModel(config.path)
			.catch((error) => {
				console.error(`Unable to load ${type} handwriting model from ${config.path}`, error);
				throw new Error(
					`Failed to load the ${type} handwriting model. Ensure you have trained the model and exported it to ${config.path}.`
				);
			});
	}
	return modelCache[type]!;
}

function normaliseLabel(probabilities: Float32Array): {
	label: HandwritingClass;
	confidence: number;
	probabilities: Record<HandwritingClass, number>;
} {
	if (probabilities.length < 2) {
		return {
			label: 'Parkinsons',
			confidence: 0,
			probabilities: {
				Parkinsons: probabilities[0] ?? 0,
				Healthy: probabilities[1] ?? 0,
			},
		};
	}

	const parkinsonsScore = probabilities[0];
	const healthyScore = probabilities[1];
	const label: HandwritingClass = parkinsonsScore >= healthyScore ? 'Parkinsons' : 'Healthy';
	const confidence = Math.max(parkinsonsScore, healthyScore);

	return {
		label,
		confidence,
		probabilities: {
			Parkinsons: parkinsonsScore,
			Healthy: healthyScore,
		},
	};
}

async function toImageTensor(
	source: HTMLImageElement | HTMLCanvasElement | ImageData | ImageBitmap,
	inputSize: number,
) {
	const tf = await loadTensorflow();
	const tensor = tf.tidy(() => {
		const pixels = tf.browser.fromPixels(source);
		const resized = tf.image.resizeBilinear(pixels, [inputSize, inputSize], true);
		const floatImg = resized.toFloat().div(tf.scalar(255));
		return floatImg.expandDims(0);
	});
	return tensor;
}

export async function predictHandwriting(
	imageElement: HTMLImageElement | HTMLCanvasElement | ImageData | ImageBitmap,
	type: HandwritingType,
): Promise<HandwritingPrediction> {
	const tf = await loadTensorflow();
	const model = await loadModel(type);
	const { inputSize, description } = MODEL_CONFIG[type];

	const inputTensor = await toImageTensor(imageElement, inputSize);
	try {
		const prediction = model.predict(inputTensor) as import('@tensorflow/tfjs').Tensor;
		const data = (await prediction.data()) as Float32Array;
		const { label, confidence, probabilities } = normaliseLabel(data);

			const summary = label === 'Parkinsons'
				? 'Pattern indicates features associated with Parkinson’s handwriting. Share these findings with a clinician for correlation with clinical tests.'
				: 'Pattern appears within the healthy reference range. Continue routine monitoring and consult your neurologist for comprehensive assessment.';

		return {
			label,
			confidence,
			probabilities,
			modelUsed: type,
			summary: `${description}. ${summary}`,
		};
	} finally {
		tf.dispose(inputTensor);
	}
}

export async function warmupHandwritingModel(type: HandwritingType) {
	const tf = await loadTensorflow();
	const model = await loadModel(type);
	const { inputSize } = MODEL_CONFIG[type];
	tf.tidy(() => {
		const zeros = tf.zeros([1, inputSize, inputSize, 3]);
		model.predict(zeros);
	});
}

export function getModelMetadata(type: HandwritingType) {
	return MODEL_CONFIG[type];
}

export function resetHandwritingModels() {
	if (!tfModule) return;
	Object.keys(modelCache).forEach((key) => {
		delete modelCache[key as HandwritingType];
	});
}
