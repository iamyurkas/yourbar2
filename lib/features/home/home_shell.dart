import 'package:flutter/material.dart';

import '../cocktails/presentation/cocktails_section.dart';
import '../ingredients/presentation/ingredients_section.dart';
import '../settings/presentation/settings_drawer.dart';
import '../shaker/presentation/shaker_section.dart';

class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _currentIndex = 0;

  final List<_NavigationDestination> _destinations = const [
    _NavigationDestination(
      label: 'Cocktails',
      icon: Icons.local_bar_outlined,
      activeIcon: Icons.local_bar,
      builder: CocktailsSection.new,
    ),
    _NavigationDestination(
      label: 'Shaker',
      icon: Icons.blender_outlined,
      activeIcon: Icons.blender,
      builder: ShakerSection.new,
    ),
    _NavigationDestination(
      label: 'Ingredients',
      icon: Icons.category_outlined,
      activeIcon: Icons.category,
      builder: IngredientsSection.new,
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_destinations[_currentIndex].label),
        actions: [
          Builder(
            builder: (context) => IconButton(
              icon: const Icon(Icons.settings_outlined),
              onPressed: () => Scaffold.of(context).openEndDrawer(),
              tooltip: 'Open settings',
            ),
          ),
        ],
      ),
      endDrawer: const SettingsDrawer(),
      body: IndexedStack(
        index: _currentIndex,
        children: _destinations
            .map((destination) => destination.builder(context))
            .toList(),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (index) => setState(() {
          _currentIndex = index;
        }),
        destinations: _destinations
            .map(
              (destination) => NavigationDestination(
                icon: Icon(destination.icon),
                selectedIcon: Icon(destination.activeIcon),
                label: destination.label,
              ),
            )
            .toList(),
      ),
    );
  }
}

typedef SectionBuilder = Widget Function(BuildContext context);

class _NavigationDestination {
  const _NavigationDestination({
    required this.label,
    required this.icon,
    required this.activeIcon,
    required this.builder,
  });

  final String label;
  final IconData icon;
  final IconData activeIcon;
  final SectionBuilder builder;
}
