/**
 * CompreFace API Utility
 * 
 * Wraps the CompreFace REST API for face recognition operations.
 * CompreFace runs locally via Docker on port 8000.
 * 
 * API Reference: http://localhost:8000/swagger
 */

const FormData = require('form-data');

const COMPREFACE_URL = process.env.COMPREFACE_URL || 'http://localhost:8000';
const COMPREFACE_API_KEY = process.env.COMPREFACE_API_KEY || '';

/**
 * Convert a base64 data URL (data:image/jpeg;base64,...) to a Buffer
 */
function base64ToBuffer(base64DataUrl) {
  // Strip the data URL prefix if present
  const base64 = base64DataUrl.replace(/^data:image\/\w+;base64,/, '');
  return Buffer.from(base64, 'base64');
}

/**
 * Make a request to the CompreFace API
 */
async function comprefaceRequest(method, path, formData = null, isJson = false, jsonBody = null) {
  const headers = {
    'x-api-key': COMPREFACE_API_KEY,
  };

  const options = {
    method,
    headers,
  };

  if (formData) {
    // form-data sets Content-Type with boundary automatically
    Object.assign(headers, formData.getHeaders());
    options.body = formData;
  } else if (isJson && jsonBody) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(jsonBody);
  }

  const url = `${COMPREFACE_URL}${path}`;
  const response = await fetch(url, options);
  
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    const errMsg = data.message || data.raw || `CompreFace error ${response.status}`;
    const err = new Error(errMsg);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}

/**
 * Add a subject (person) to CompreFace recognition service.
 * Subject ID is a string identifier (e.g. "student_42").
 * CompreFace auto-creates subjects when adding faces, but this can be called explicitly.
 */
async function addSubject(subjectId) {
  try {
    return await comprefaceRequest('POST', '/api/v1/recognition/subjects', null, true, {
      subject: subjectId
    });
  } catch (err) {
    // Subject may already exist — that's fine
    if (err.status === 400 && err.data && /already exists/i.test(JSON.stringify(err.data))) {
      return { subject: subjectId, existing: true };
    }
    throw err;
  }
}

/**
 * Delete a subject and ALL their face examples from CompreFace.
 */
async function deleteSubject(subjectId) {
  try {
    return await comprefaceRequest('DELETE', `/api/v1/recognition/subjects/${encodeURIComponent(subjectId)}`);
  } catch (err) {
    // Subject may not exist — that's fine
    if (err.status === 404) {
      return { deleted: false, reason: 'not_found' };
    }
    throw err;
  }
}

/**
 * Add a face image example for a subject.
 * The image should be a base64 data URL or a Buffer.
 * Returns the image_id and subject from CompreFace.
 */
async function addFace(subjectId, imageBase64) {
  const buffer = typeof imageBase64 === 'string' ? base64ToBuffer(imageBase64) : imageBase64;

  const form = new FormData();
  form.append('file', buffer, {
    filename: 'face.jpg',
    contentType: 'image/jpeg',
  });

  return await comprefaceRequest(
    'POST',
    `/api/v1/recognition/faces?subject=${encodeURIComponent(subjectId)}&det_prob_threshold=0.8`,
    form
  );
}

/**
 * Delete all face examples for a subject (useful before re-registering).
 */
async function deleteAllFaces(subjectId) {
  try {
    return await comprefaceRequest(
      'DELETE',
      `/api/v1/recognition/faces?subject=${encodeURIComponent(subjectId)}`
    );
  } catch (err) {
    if (err.status === 404) {
      return { deleted: 0 };
    }
    throw err;
  }
}

/**
 * Recognize a face from an image.
 * Returns the CompreFace recognition result with subjects and similarity scores.
 * 
 * Response format:
 * {
 *   result: [{
 *     box: { probability, x_max, y_max, x_min, y_min },
 *     subjects: [{ subject: "student_42", similarity: 0.985 }]
 *   }]
 * }
 */
async function recognize(imageBase64, options = {}) {
  const buffer = typeof imageBase64 === 'string' ? base64ToBuffer(imageBase64) : imageBase64;
  const limit = options.limit || 1;
  const detProbThreshold = options.det_prob_threshold || 0.8;
  const similarityThreshold = options.similarity_threshold || 0.0; // return all, filter on our side

  const form = new FormData();
  form.append('file', buffer, {
    filename: 'face.jpg',
    contentType: 'image/jpeg',
  });

  return await comprefaceRequest(
    'POST',
    `/api/v1/recognition/recognize?limit=${limit}&det_prob_threshold=${detProbThreshold}&prediction_count=${limit}`,
    form
  );
}

/**
 * Verify a face against a specific subject.
 * Returns similarity score between the image and the stored subject.
 */
async function verify(subjectId, imageBase64) {
  const buffer = typeof imageBase64 === 'string' ? base64ToBuffer(imageBase64) : imageBase64;

  const form = new FormData();
  form.append('file', buffer, {
    filename: 'face.jpg',
    contentType: 'image/jpeg',
  });

  return await comprefaceRequest(
    'POST',
    `/api/v1/recognition/faces/${encodeURIComponent(subjectId)}/verify?det_prob_threshold=0.8`,
    form
  );
}

/**
 * Check if CompreFace is running and accessible.
 */
async function healthCheck() {
  try {
    const response = await fetch(`${COMPREFACE_URL}/api/v1/recognition/subjects`, {
      headers: { 'x-api-key': COMPREFACE_API_KEY }
    });
    return response.ok;
  } catch {
    return false;
  }
}

module.exports = {
  addSubject,
  deleteSubject,
  addFace,
  deleteAllFaces,
  recognize,
  verify,
  healthCheck,
  base64ToBuffer,
};
