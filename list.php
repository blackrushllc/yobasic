<?php
/**
 * list.php - Directory listing for Downloads Explorer
 */

$base_dir = __DIR__ . DIRECTORY_SEPARATOR . 'downloads';
$requested_path = isset($_GET['path']) ? $_GET['path'] : '/';

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

$items = [];
$dir_handle = opendir($target_dir);

if ($dir_handle) {
    while (($file = readdir($dir_handle)) !== false) {
        if ($file === '.' || $file === '..' || $file[0] === '.') continue;

        $full_path = $target_dir . DIRECTORY_SEPARATOR . $file;
        $type = is_dir($full_path) ? 'dir' : 'file';
        $ext = pathinfo($file, PATHINFO_EXTENSION);
        
        $relative_url = 'downloads/' . ($requested_path ? $requested_path . '/' : '') . $file;
        
        $items[] = [
            'name' => $file,
            'type' => $type,
            'size' => $type === 'file' ? filesize($full_path) : 0,
            'mtime' => filemtime($full_path),
            'ext' => $ext,
            'url' => $relative_url
        ];
    }
    closedir($dir_handle);
}

// Sort items: dirs first, then by name
usort($items, function($a, $b) {
    if ($a['type'] === $b['type']) {
        return strcasecmp($a['name'], $b['name']);
    }
    return $a['type'] === 'dir' ? -1 : 1;
});

$parent_path = ($requested_path === '') ? null : dirname('/' . $requested_path);
if ($parent_path === '\\' || $parent_path === '/') $parent_path = '';

header('Content-Type: application/json');
echo json_encode([
    'path' => '/' . $requested_path,
    'parentPath' => $parent_path,
    'items' => $items
]);
