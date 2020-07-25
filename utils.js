function joinPath(path1, path2) {
  return (
    path1.replace(/\/+$/, '') + '/' + 
    path2.replace(/^\/+/, ''));
}

exports.makeAbsolute = function(relativePath) {
  return joinPath(__dirname, relativePath);
}