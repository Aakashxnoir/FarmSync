// Web sign-in through ClerkJS. clerk_flutter cannot start in a browser
// (path_provider + dart:io), so web talks to Clerk's own browser SDK instead.
// Other platforms get no-op stubs and keep using clerk_flutter.
export 'clerk_web_stub.dart' if (dart.library.js_interop) 'clerk_web_js.dart';
