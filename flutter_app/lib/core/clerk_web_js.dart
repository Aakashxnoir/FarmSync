import 'dart:async';
import 'dart:convert';
import 'dart:js_interop';

import 'package:web/web.dart' as web;

@JS('Clerk')
external _Clerk? get _clerk;

extension type _Clerk._(JSObject _) implements JSObject {
  external JSPromise<JSAny?> load();
  external _Session? get session;
  external void openSignIn();
  external JSPromise<JSAny?> signOut();
  external JSFunction addListener(JSFunction listener);
}

extension type _Session._(JSObject _) implements JSObject {
  external JSPromise<JSString?> getToken();
}

/// Injects clerk.browser.js for this publishable key, then waits for
/// `Clerk.load()`. The Frontend API host is encoded in the key itself.
Future<void> loadClerk(String publishableKey) async {
  if (_clerk == null) {
    final encoded = publishableKey.split('_').last;
    final host = utf8.decode(base64.decode(base64.normalize(encoded))).replaceAll(r'$', '');
    final loaded = Completer<void>();
    final script = web.HTMLScriptElement()
      ..src = 'https://$host/npm/@clerk/clerk-js@5/dist/clerk.browser.js'
      ..crossOrigin = 'anonymous'
      ..onload = ((web.Event _) => loaded.complete()).toJS
      ..onerror = ((web.Event _) => loaded.completeError(StateError('Could not load Clerk'))).toJS;
    script.setAttribute('data-clerk-publishable-key', publishableKey);
    web.document.head!.append(script);
    await loaded.future;
  }
  await _clerk!.load().toDart;
}

/// Current session JWT, or null when signed out. ClerkJS caches and refreshes it.
Future<String?> clerkSessionToken() async {
  final token = await _clerk?.session?.getToken().toDart;
  return token?.toDart;
}

/// Calls [listener] on every sign-in / sign-out / session change; returns the
/// unsubscribe function.
void Function() onClerkChange(void Function() listener) {
  final clerk = _clerk;
  if (clerk == null) return () {};
  final unsubscribe = clerk.addListener(((JSAny? _) => listener()).toJS);
  return () => unsubscribe.callAsFunction();
}

void openClerkSignIn() => _clerk?.openSignIn();

Future<void> clerkSignOut() async {
  await _clerk?.signOut().toDart;
}
