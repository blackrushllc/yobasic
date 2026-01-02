<?php
/**
 * upload.php - Handle file uploads for Downloads Explorer
 */

$base_dir = __DIR__ . DIRECTORY_SEPARATOR . 'downloads';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('HTTP/1.1 405 Method Not Allowed');
    exit;
}

$requested_path = isset($_POST['path']) ? $_POST['path'] : '/';
// Normalize path
$requested_path = str_replace(['..', '\\'], ['', '/'], $requested_path);
$requested_path = trim($requested_path, '/');

$target_dir = realpath($base_dir . ($requested_path ? DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $requested_path) : ''));

// Safety check: must be within base_dir
if (!$target_dir || strpos($target_dir, realpath($base_dir)) !== 0) {
    header('HTTP/1.1 403 Forbidden');
    echo json_encode(['error' => 'Access denied']);
    exit;
}

if (!isset($_FILES['file'])) {
    header('HTTP/1.1 400 Bad Request');
    echo json_encode(['error' => 'No file uploaded']);
    exit;
}

$file = $_FILES['file'];
$filename = basename($file['name']);
$destination = $target_dir . DIRECTORY_SEPARATOR . $filename;

if (move_uploaded_file($file['tmp_name'], $destination)) {
    echo json_encode([
        'success' => true,
        'filename' => $filename,
        'path' => '/' . $requested_path
    ]);
} else {
    header('HTTP/1.1 500 Internal Server Error');
    echo json_encode(['error' => 'Failed to move uploaded file']);
}
