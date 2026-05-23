use ort::{session::Session, value::Value, Error};

pub struct OnnxInference {
    session: Session,
}

impl OnnxInference {
    pub fn new(model_path: &str) -> Result<Self, Error> {
        let session = Session::builder()?.commit_from_file(model_path)?;
        Ok(Self { session })
    }

    pub fn score(&mut self, features: [f32; 7]) -> Result<f32, Box<dyn std::error::Error>> {
        // Use a tuple (shape, vec) instead of ndarray to avoid crate version conflicts
        let input_tensor = Value::from_array(([1, 7], features.to_vec()))?;
        
        let inputs = ort::inputs!["float_input" => input_tensor];
        let outputs = self.session.run(inputs)?;
        
        // Output 1 usually contains the anomaly scores from skl2onnx IsolationForest
        let tensor = outputs[1].try_extract_tensor::<f32>()?;
        let (_, slice) = tensor;
        
        Ok(slice[0])
    }

    pub fn is_anomaly(&self, score: f32) -> bool {
        score < -0.2
    }
}
