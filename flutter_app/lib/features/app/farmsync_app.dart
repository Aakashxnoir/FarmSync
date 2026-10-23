import 'dart:async';

import 'package:clerk_flutter/clerk_flutter.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/brand.dart';
import '../../core/auth_token.dart';
import '../../core/clerk_web.dart';
import '../../core/demo_session.dart';
import '../../core/env.dart';
import '../../core/theme.dart';
import '../auth/sign_in_page.dart';
import '../home/home_shell.dart';

/// App root. Signed out shows Google / demo sign-in; signed in shows farms.
class FarmSyncApp extends ConsumerWidget {
  const FarmSyncApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final demoSession = ref.watch(demoSessionProvider);

    // Boot-time dart-define shortcut, or in-app "Open demo farms".
    if (Env.isDevLogin || demoSession) {
      return MaterialApp(
        title: AppBrand.name,
        theme: buildAppTheme(),
        debugShowCheckedModeBanner: false,
        home: const _DemoHome(),
      );
    }

    // clerk_flutter cannot start in a browser (path_provider + dart:io), so
    // web signs in through ClerkJS instead (core/clerk_web.dart).
    if (kIsWeb) {
      return MaterialApp(
        title: AppBrand.name,
        theme: buildAppTheme(),
        debugShowCheckedModeBanner: false,
        home: const _WebClerkGate(),
      );
    }

    if (!Env.isClerkConfigured) {
      return MaterialApp(
        theme: buildAppTheme(),
        debugShowCheckedModeBanner: false,
        home: const _MissingConfigScreen(),
      );
    }

    return ClerkAuth(
      config: ClerkAuthConfig(publishableKey: Env.clerkPublishableKey),
      child: MaterialApp(
        title: AppBrand.name,
        theme: buildAppTheme(),
        debugShowCheckedModeBanner: false,
        home: ClerkErrorListener(
          child: ClerkAuthBuilder(
            signedInBuilder: (context, authState) => const SessionTokenBinder(child: HomeShell()),
            signedOutBuilder: (context, authState) => const SignInPage(),
          ),
        ),
      ),
    );
  }
}

/// Pushes the Clerk session JWT into [bearerTokenProvider] so the API client
/// can authenticate.
class SessionTokenBinder extends ConsumerStatefulWidget {
  const SessionTokenBinder({super.key, required this.child});

  final Widget child;

  @override
  ConsumerState<SessionTokenBinder> createState() => _SessionTokenBinderState();
}

class _SessionTokenBinderState extends ConsumerState<SessionTokenBinder> {
  bool _ready = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _bind());
  }

  Future<void> _bind() async {
    try {
      final auth = ClerkAuth.of(context, listen: false);
      final token = await auth.sessionToken();
      if (!mounted) return;
      ref.read(bearerTokenProvider.notifier).setToken(token.jwt);
      setState(() => _ready = true);
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = '$e';
          _ready = true;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!_ready) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator(color: AppColors.deepGreen)),
      );
    }
    if (_error != null) {
      return Scaffold(
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(28),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.lock_outline, size: 48, color: AppColors.terracotta),
                const SizedBox(height: 16),
                Text('Could not start your session',
                    textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 8),
                Text(_error!,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.clay)),
                const SizedBox(height: 20),
                OutlinedButton(
                  onPressed: () {
                    setState(() {
                      _ready = false;
                      _error = null;
                    });
                    _bind();
                  },
                  child: const Text('Try again'),
                ),
              ],
            ),
          ),
        ),
      );
    }
    return widget.child;
  }
}

/// Web counterpart of ClerkAuthBuilder + [SessionTokenBinder]: loads ClerkJS,
/// keeps [bearerTokenProvider] on the current session JWT (Clerk tokens live
/// ~60 s, so it re-reads on a timer), and picks sign-in vs. farms.
class _WebClerkGate extends ConsumerStatefulWidget {
  const _WebClerkGate();

  @override
  ConsumerState<_WebClerkGate> createState() => _WebClerkGateState();
}

class _WebClerkGateState extends ConsumerState<_WebClerkGate> {
  bool _loaded = false;
  bool _signedIn = false;
  void Function()? _unsubscribe;
  Timer? _refresh;

  @override
  void initState() {
    super.initState();
    _start();
  }

  Future<void> _start() async {
    try {
      await loadClerk(Env.clerkPublishableKey);
      _unsubscribe = onClerkChange(_sync);
      _refresh = Timer.periodic(const Duration(seconds: 45), (_) => _sync());
    } catch (_) {
      // Clerk unreachable: the sign-in page still offers the demo.
    }
    await _sync();
  }

  Future<void> _sync() async {
    final token = await clerkSessionToken();
    if (!mounted) return;
    ref.read(bearerTokenProvider.notifier).setToken(token);
    setState(() {
      _loaded = true;
      _signedIn = token != null;
    });
  }

  @override
  void dispose() {
    _unsubscribe?.call();
    _refresh?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!_loaded) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator(color: AppColors.deepGreen)),
      );
    }
    return _signedIn ? const HomeShell() : const SignInPage();
  }
}

class _DemoHome extends ConsumerStatefulWidget {
  const _DemoHome();

  @override
  ConsumerState<_DemoHome> createState() => _DemoHomeState();
}

class _DemoHomeState extends ConsumerState<_DemoHome> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (ref.read(bearerTokenProvider) == null) {
        ref.read(bearerTokenProvider.notifier).setToken(Env.devLoginToken);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return const HomeShell(demoMode: true);
  }
}

class _MissingConfigScreen extends StatelessWidget {
  const _MissingConfigScreen();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.settings_outlined, size: 48, color: AppColors.clay),
              const SizedBox(height: 16),
              Text(
                'Missing CLERK_PUBLISHABLE_KEY.\n\n'
                'Run with:\n'
                'flutter run \\\n'
                '  --dart-define=CLERK_PUBLISHABLE_KEY=pk_... \\\n'
                '  --dart-define=API_BASE_URL=https://your-api',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
