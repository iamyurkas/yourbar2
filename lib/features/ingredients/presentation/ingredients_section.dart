import 'package:flutter/material.dart';

class IngredientsSection extends StatelessWidget {
  const IngredientsSection({super.key});

  static const _tabs = <_SectionTab>[
    _SectionTab('All', Icons.all_inbox_outlined),
    _SectionTab('My', Icons.check_circle_outline),
    _SectionTab('Shopping', Icons.shopping_bag_outlined),
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
                          'Organize your inventory, shopping list and personal bar.',
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
          description: 'Add ingredient catalog content here',
        ),
        _PlaceholderCard(
          title: '$title (3)',
          description: 'Provide filters, search and actions later',
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
                  Icons.local_grocery_store,
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
