import 'package:flutter/material.dart';

class CocktailsSection extends StatelessWidget {
  const CocktailsSection({super.key});

  static const _tabs = <_SectionTab>[
    _SectionTab('All', Icons.list_alt_outlined),
    _SectionTab('My', Icons.favorite_outline),
    _SectionTab('Favorites', Icons.star_border),
  ];

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: _tabs.length,
      child: Column(
        children: [
          Material(
            color: Theme.of(context).colorScheme.surface,
            child: TabBar(
              isScrollable: true,
              labelColor: Theme.of(context).colorScheme.primary,
              indicatorColor: Theme.of(context).colorScheme.primary,
              tabs: _tabs
                  .map(
                    (tab) => Tab(
                      text: tab.label,
                      icon: Icon(tab.icon),
                    ),
                  )
                  .toList(),
            ),
          ),
          const Divider(height: 1),
          Expanded(
            child: TabBarView(
              children: _tabs
                  .map(
                    (tab) => _SlidingPlaceholder(
                      title: tab.label,
                      description:
                          'Swipe horizontally to switch between cocktail lists.',
                    ),
                  )
                  .toList(),
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionTab {
  const _SectionTab(this.label, this.icon);

  final String label;
  final IconData icon;
}

class _SlidingPlaceholder extends StatelessWidget {
  const _SlidingPlaceholder({
    required this.title,
    required this.description,
  });

  final String title;
  final String description;

  @override
  Widget build(BuildContext context) {
    return PageView(
      controller: PageController(viewportFraction: 0.92),
      children: [
        _PlaceholderCard(title: title, description: description),
        _PlaceholderCard(
          title: '$title (2)',
          description: 'Additional list placeholder',
        ),
        _PlaceholderCard(
          title: '$title (3)',
          description: 'Replace with real cocktail list content',
        ),
      ],
    );
  }
}

class _PlaceholderCard extends StatelessWidget {
  const _PlaceholderCard({
    required this.title,
    required this.description,
  });

  final String title;
  final String description;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Card(
        elevation: 2,
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.local_bar,
                  size: 48,
                  color: Theme.of(context).colorScheme.primary,
                ),
                const SizedBox(height: 16),
                Text(
                  title,
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 8),
                Text(
                  description,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
