import 'package:flutter/material.dart';

class SettingsDrawer extends StatelessWidget {
  const SettingsDrawer({super.key});

  @override
  Widget build(BuildContext context) {
    return Drawer(
      child: SafeArea(
        child: ListView(
          padding: EdgeInsets.zero,
          children: const [
            _SettingsHeader(),
            Divider(),
            _SettingsToggle(
              title: 'Ignore garnishes',
              subtitle: 'All garnishes are optional',
            ),
            _SettingsToggle(
              title: 'Always allow substitutes',
              subtitle: 'Use base or branded alternatives regardless of recipe',
            ),
            _SettingsToggle(
              title: 'Use metric system',
              subtitle: 'Switch to use U.S. units',
              value: true,
            ),
            _SettingsToggle(
              title: 'Keep screen awake',
              subtitle:
                  'Prevent the phone from sleeping while viewing cocktail details',
            ),
            _SettingsToggle(
              title: 'Tabs on top',
              subtitle: 'Choose to show tabs at bottom',
              value: true,
            ),
            Divider(),
            _SettingsNavigation(
              title: 'Favorites rating',
              subtitle: 'Show all favorite cocktails',
              icon: Icons.star_outline,
            ),
            _SettingsNavigation(
              title: 'Start screen',
              subtitle: 'Cocktails • My',
              icon: Icons.home_outlined,
            ),
            _SettingsNavigation(
              title: 'Ingredient tags',
              subtitle: 'Create, edit or remove ingredient tags',
              icon: Icons.sell_outlined,
            ),
            _SettingsNavigation(
              title: 'Cocktail tags',
              subtitle: 'Create, edit or remove cocktail tags',
              icon: Icons.loyalty_outlined,
            ),
          ],
        ),
      ),
    );
  }
}

class _SettingsHeader extends StatelessWidget {
  const _SettingsHeader();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return DrawerHeader(
      margin: EdgeInsets.zero,
      decoration: BoxDecoration(
        color: theme.colorScheme.primaryContainer,
      ),
      child: Align(
        alignment: Alignment.bottomLeft,
        child: Text(
          'Settings',
          style: theme.textTheme.headlineSmall?.copyWith(
            color: theme.colorScheme.onPrimaryContainer,
          ),
        ),
      ),
    );
  }
}

class _SettingsToggle extends StatelessWidget {
  const _SettingsToggle({
    required this.title,
    required this.subtitle,
    this.value = false,
  });

  final String title;
  final String subtitle;
  final bool value;

  @override
  Widget build(BuildContext context) {
    return SwitchListTile.adaptive(
      title: Text(title),
      subtitle: Text(subtitle),
      value: value,
      onChanged: (_) {},
    );
  }
}

class _SettingsNavigation extends StatelessWidget {
  const _SettingsNavigation({
    required this.title,
    required this.subtitle,
    required this.icon,
  });

  final String title;
  final String subtitle;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(icon),
      title: Text(title),
      subtitle: Text(subtitle),
      trailing: const Icon(Icons.chevron_right),
      onTap: () {},
    );
  }
}
