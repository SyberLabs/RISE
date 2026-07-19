const entry = (words, hash) => Object.freeze({
  words,
  checksum: 'sha256:' + hash
});

// Generated from the exact UTF-8 runtime strings in payloads.js.
// Tests recompute every value so hand edits fail closed.
export const ATRIUM_PILOT_INTEGRITY = Object.freeze({
  'pass-anaximander-fragment': entry(42, '560f9e8f1725249e742a835ec96961b148118352c6513801b3d5b10e7b82742f'),
  'pass-angostura': entry(106, 'e621474e8ac979ce7176918d5c9d954689646a2577870c37bbc2a3323841bddc'),
  'pass-aristotle-soul': entry(124, '4c7c63979190bb318da60fba531db0b5db27785fed079d41c1445daadd0834d5'),
  'pass-aristotle-substance': entry(97, '385b9c27b9fc36e2f81e00d28c553daf216da3f55644e4270a8db483048b1286'),
  'pass-augustine-platonic-books': entry(126, '7f04c6e71109af67ef63c085f992d2e5367da82ad6526cd39f66db951f85dddb'),
  'pass-boethius-eternity': entry(113, '77eae6c3a07a1eb395f5757659809c95d486a57c85fd36336905899f86c0b74c'),
  'pass-cadiz': entry(92, 'a1de3a1c63829de3812c25fbe6188f4a86389a91eed051f632e886efa305d0c1'),
  'pass-common-sense': entry(92, '0e248acd430ccd1242845994e05047ae3a58780f1d679aaee2d05d7cc379a811'),
  'pass-dionysius-mystical': entry(95, '3e067e7ab72f5ec502a693b9f41c5bcd023c7feb45653575971d6efd7145655c'),
  'pass-epictetus-control': entry(109, '67db39947f59a3e721d8b02998b3ec6b084f0d483bdaf97fe300ce2fc3ee6367'),
  'pass-equiano': entry(134, 'bf04d068a40dff12a1dd3f451bb6cb36e35491c19f2406a054fbd4ab161e52f6'),
  'pass-federalist-10': entry(116, '9261ef10e1c2167fde79f2279ff9dc80552918ad8262ba99c91fc026b0e2f1e3'),
  'pass-haiti-constitution-1801': entry(91, '7acbe71808d61a02213fa45159fa7498075e28a8e76211d836439329275db196'),
  'pass-haiti-independence-1804': entry(95, '9ba9e65a8dbe6b6c2ccac26db5914c75cf279b5015ba42baeab4d23c7c7d9e4d'),
  'pass-monroe-message': entry(95, '98e2f80ca4f998c01b1071eac9eed2822002bd1c55ca68699cd98e63b9ca4489'),
  'pass-plato-cave': entry(144, 'b130a3d0b872c318fe7d4af142a7c968448bbf33dd2977f1abee16b1b55367ce'),
  'pass-plato-divided-line': entry(140, '1add33fba41ab972810a92792cda1cd387f6e355d392fb5ae548395b2ac70395'),
  'pass-plato-forms': entry(125, '770f8a7422187929c141fec7894a63242083408cd770392c5f97253a0787baf5'),
  'pass-plato-recollection': entry(206, 'ff776fc68e72b4600af04239fa0fc434f027a92179d87f2dbb45eb6fbb4116dc'),
  'pass-protagoras-measure': entry(115, '6c5c3f2a4ec921e73140aacad69ae38addb5e7075935c7fec85758416caa8cb8'),
  'pass-rights-man': entry(79, '7fe97ffb180f3369da90a019442c9572aa283958dda2c3dc7ce537eacc9fc5e9'),
  'pass-rights-woman': entry(96, 'ee2dbc30ae68d56e6e884895a4b31c13dcb43d02235d0d2b5d681a91508c8faf'),
  'pass-seneca-declaration': entry(126, 'a438bd50c791d90f992eee68011f8d98d816d349cb65e9abeb9c7a1675b6f6b6'),
  'pass-socrates-apology': entry(101, 'b53401ce8c9b8864735e8fb625b89fa80c64f170a0119ebdc33a68032716ef12'),
  'pass-stamp-act': entry(129, '67e5b677a4f9a0e36cd263cdac5631cf8068d678abf82292aa1ecc1bdfce9760'),
  'pass-us-constitution': entry(77, '0b007d9856a7d7d3f7975753f3e352ec89a6b0fc53a49ab92f3ae1b97dfec33f'),
  'pass-us-declaration': entry(116, '92e8cb42a078867a7be40bd354be4ea0ea1c536a43eff06f72db45ad1ff327cf')
});
