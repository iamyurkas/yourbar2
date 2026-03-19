import type { TranslationDictionary } from "@/libs/i18n/types";

export const deDETranslations: TranslationDictionary = {
  "common.search": "Suchen",
  "common.openNavigation": "Navigation öffnen",
  "common.clearSearch": "Suche löschen",
  "common.openScreenHelp": "Hilfe öffnen",
  "common.goBack": "Zurück",
  "common.filterItems": "Filtern",
  "common.filterBy": "Filtern nach",
  "common.help": "Hilfe",
  "common.gotIt": "Verstanden",
  "common.ok": "OK",
  "common.tryAgainLater": "Bitte versuchen Sie es später erneut.",
  "common.save": "Speichern",
  "common.delete": "Löschen",
  "common.cancel": "Abbrechen",
  "common.create": "Erstellen",
  "common.close": "Schließen",
  "common.closeTagFilters": "Tag-Filter schließen",
  "common.noMethodsAvailable": "Keine Methoden verfügbar",
  "common.noTagsAvailable": "Keine Tags verfügbar",
  "common.noRatingsAvailable": "Keine Bewertungen verfügbar",
  "common.clearFilters": "Filter löschen",
  "common.and": "UND",
  "common.or": "ODER",
  "common.clear": "Löschen",
  "common.show": "Anzeigen",
  "common.tabAll": "Alle",
  "common.tabMy": "Meine",
  "common.tabShopping": "Einkaufsliste",
  "common.tabParty": "Party",

  "cocktails.emptyMy":
    "Markieren Sie Ihre Zutaten, um hier verfügbare Cocktails zu sehen.",
  "cocktails.emptyAll": "Noch keine Cocktails",
  "cocktails.emptyParty":
    "Wählen Sie Cocktails aus, um eine Party-Einkaufsliste zu erstellen.",
  "cocktails.helpMyTitle": "Meine Cocktails",
  "cocktails.helpMyText":
    "Dieser Bildschirm zeigt Cocktails, die Sie mit Ihren aktuellen Zutaten zubereiten können.\n\nNutzen Sie die Suche, um Ihre Rezepte schnell zu finden, und verwenden Sie Filter, um die Liste nach Tags oder Methode einzugrenzen.",
  "cocktails.helpAllTitle": "Alle Cocktails",
  "cocktails.helpAllText":
    "Dieser Bildschirm zeigt die vollständige Cocktailsammlung.\n\nNutzen Sie die Suche, wechseln Sie zwischen den Tabs und filtern Sie nach Methode oder Tags.",
  "cocktails.helpPartyTitle": "Party-Cocktails",
  "cocktails.helpPartyText":
    "Wählen Sie Cocktails aus und tippen Sie dann auf die Warenkorb-Schaltfläche, um alle Zutaten zur Einkaufsliste hinzuzufügen.",

  "ingredients.emptyMy":
    "Markieren Sie Zutaten, die Sie besitzen, um sie hier zu sehen.",
  "ingredients.emptyAll": "Noch keine Zutaten",
  "ingredients.helpMyTitle": "Meine Zutaten",
  "ingredients.helpMyText":
    "Dieser Bildschirm zeigt Zutaten, die Sie besitzen.\n\nSuchen Sie nach Namen und verwenden Sie Tag-Filter, um Ihre persönliche Sammlung schnell zu organisieren.",
  "ingredients.helpAllTitle": "Alle Zutaten",
  "ingredients.helpAllText":
    "Dieser Bildschirm zeigt die vollständige Zutatenliste.\n\nNutzen Sie die Suche und Tags, um schnell zu finden, was Sie brauchen.",
  "ingredients.helpShoppingTitle": "Einkaufsliste",
  "ingredients.helpShoppingText":
    "Dieser Bildschirm zeigt Zutaten, die Sie kaufen möchten.\n\nMarkieren Sie Zutaten nach dem Kauf als verfügbar, um sie in „Meine Zutaten“ zu verschieben.",

  "ingredientForm.changeImage": "Bild ändern",
  "ingredientForm.addImage": "Tippen, um ein Foto hinzuzufügen",
  "ingredientForm.mediaLibraryAccessTitle": "Zugriff auf die Mediathek",
  "ingredientForm.mediaLibraryAccessMessage":
    "Aktivieren Sie in den Systemeinstellungen die Berechtigung für die Fotomediathek, um ein Zutatenbild hinzuzufügen.",
  "ingredientForm.couldNotPickImage": "Bild konnte nicht ausgewählt werden",
  "ingredientForm.cameraAccessRequired": "Kamerazugriff erforderlich",
  "ingredientForm.cameraAccessRequiredMessage":
    "Aktivieren Sie in den Systemeinstellungen die Kameraberechtigung, um ein Zutatenfoto aufzunehmen.",
  "ingredientForm.couldNotTakePhoto": "Foto konnte nicht aufgenommen werden",
  "ingredientForm.addPhotoTitle": "Tippen, um ein Foto hinzuzufügen",
  "ingredientForm.addPhotoMessage":
    "Wählen Sie, wie Sie ein Zutatenfoto hinzufügen möchten.",
  "ingredientForm.takePhoto": "Foto aufnehmen",
  "ingredientForm.chooseFromGallery": "Aus Galerie auswählen",
  "ingredientForm.nameRequiredTitle": "Name erforderlich",
  "ingredientForm.nameRequiredMessage":
    "Bitte geben Sie einen Zutatennamen ein.",
  "ingredientForm.ingredientNotFound": "Zutat nicht gefunden",
  "ingredientForm.couldNotSave": "Zutat konnte nicht gespeichert werden",
  "ingredientForm.leaveWithoutSavingTitle": "Ohne Speichern verlassen?",
  "ingredientForm.leaveWithoutSavingMessage":
    "Ihre Änderungen gehen verloren, wenn Sie diesen Bildschirm verlassen.",
  "ingredientForm.stay": "Bleiben",
  "ingredientForm.leave": "Verlassen",
  "ingredientForm.deleteConfirmNamed":
    "Sind Sie sicher, dass Sie\n{{name}} löschen möchten?\n\nDiese Aktion kann nicht rückgängig gemacht werden.",
  "ingredientForm.deleteConfirmUnnamed":
    "Sind Sie sicher, dass Sie diese Zutat löschen möchten?\n\nDiese Aktion kann nicht rückgängig gemacht werden.",
  "ingredientForm.deleteTitle": "Zutat löschen",
  "ingredientForm.couldNotDelete": "Zutat konnte nicht gelöscht werden",
  "ingredientForm.baseDisableBrandedVariants":
    "Diese Zutat ist eine Basis für markengebundene Zutaten und kann daher selbst nicht markengebunden sein.",
  "ingredientForm.baseDisableStyledIngredient":
    "Stil-Zutaten können nicht markengebunden sein. Entfernen Sie die Stil-Verknüpfung, um die Auswahl der Basiszutat zu aktivieren.",
  "ingredientForm.styleDisableStyledVariants":
    "Diese Zutat ist eine Basis für Stil-Zutaten und kann daher selbst kein Stil sein.",
  "ingredientForm.styleDisableBrandedIngredient":
    "Markengebundene Zutaten können keine Stil-Zutaten sein. Entfernen Sie die Verknüpfung zur Basiszutat, um die Stil-Auswahl zu aktivieren.",
  "ingredientForm.editTitle": "Zutat bearbeiten",
  "ingredientForm.addTitle": "Neue Zutat hinzufügen",
  "ingredientForm.goBack": "Zurück",
  "ingredientForm.name": "Name",
  "ingredientForm.namePlaceholder": "z. B. Ingwersirup",
  "ingredientForm.removePhoto": "Foto entfernen",
  "ingredientForm.tags": "Tags",
  "ingredientForm.createTag": "Tag erstellen",
  "ingredientForm.selectTags": "Tags auswählen",
  "ingredientForm.baseIngredient": "Basiszutat",
  "ingredientForm.baseHint":
    "Es können nur Zutaten als Basiszutaten ausgewählt werden, die nicht bereits markengebunden sind.",
  "ingredientForm.changeBaseIngredient": "Basiszutat ändern",
  "ingredientForm.selectBaseIngredient": "Basiszutat auswählen",
  "ingredientForm.removeBaseIngredient": "Basiszutat entfernen",
  "ingredientForm.none": "Keine",
  "ingredientForm.styleIngredient": "Stil-Zutat",
  "ingredientForm.styleHint":
    "Als Stil-Zutat können nur Basiszutaten ausgewählt werden, die nicht markengebunden sind und nicht bereits selbst ein Stil sind.",
  "ingredientForm.changeStyleIngredient": "Stil-Zutat ändern",
  "ingredientForm.selectStyleIngredient": "Stil-Zutat auswählen",
  "ingredientForm.removeStyleIngredient": "Stil-Zutat entfernen",
  "ingredientForm.description": "Beschreibung",
  "ingredientForm.descriptionPlaceholder":
    "Geschmacksnotizen oder Verwendungsvorschläge hinzufügen",
  "ingredientForm.saveIngredient": "Zutat speichern",
  "ingredientForm.deleteIngredient": "Zutat löschen",
  "ingredientForm.searchIngredients": "Zutaten suchen",
  "ingredientForm.noIngredientsFound": "Keine Zutaten gefunden",
  "ingredientForm.helpTitle": "Zutat hinzufügen",
  "ingredientForm.helpMessage":
    "Verwenden Sie diesen Bildschirm, um eine neue Zutatenkarte zu erstellen.\n\nGeben Sie einen Namen ein, fügen Sie optional ein Foto, Tags, eine Basis- oder Stil-Zutat sowie Notizen hinzu und tippen Sie dann auf Speichern.\n\nEine Stil-Zutat kann nur mit einer Basiszutat verknüpft werden, die weder markengebunden noch selbst ein Stil ist.",
  "ingredientForm.newTag": "Neuer Tag",

  "cocktailForm.editTitle": "Cocktail bearbeiten",
  "cocktailForm.addTitle": "Neuen Cocktail hinzufügen",
  "cocktailForm.changePhoto": "Foto ändern",
  "cocktailForm.addPhoto": "Foto hinzufügen",
  "cocktailForm.mediaAccessRequired": "Zugriff auf die Mediathek erforderlich",
  "cocktailForm.mediaAccessRequiredMessage":
    "Aktivieren Sie in den Systemeinstellungen die Berechtigung für die Fotomediathek, um ein Cocktailfoto hinzuzufügen.",
  "cocktailForm.couldNotPickImage": "Bild konnte nicht ausgewählt werden",
  "cocktailForm.cameraAccessRequired": "Kamerazugriff erforderlich",
  "cocktailForm.cameraAccessRequiredMessage":
    "Aktivieren Sie in den Systemeinstellungen die Kameraberechtigung, um ein Cocktailfoto aufzunehmen.",
  "cocktailForm.couldNotTakePhoto": "Foto konnte nicht aufgenommen werden",
  "cocktailForm.addPhotoMessage":
    "Wählen Sie, wie Sie ein Cocktailfoto hinzufügen möchten.",
  "cocktailForm.takePhoto": "Foto aufnehmen",
  "cocktailForm.chooseFromGallery": "Aus Galerie auswählen",
  "cocktailForm.nameRequired": "Name erforderlich",
  "cocktailForm.nameRequiredMessage":
    "Bitte geben Sie einen Cocktailnamen ein.",
  "cocktailForm.recipeRequired": "Rezept erforderlich",
  "cocktailForm.recipeRequiredMessage":
    "Fügen Sie dem Cocktail mindestens eine Zutat hinzu.",
  "cocktailForm.couldNotSave": "Cocktail konnte nicht gespeichert werden",
  "cocktailForm.cocktailNotFound": "Cocktail nicht gefunden",
  "cocktailForm.deleteConfirmNamed":
    "Sind Sie sicher, dass Sie\n{{name}} löschen möchten?\n\nDiese Aktion kann nicht rückgängig gemacht werden.",
  "cocktailForm.deleteConfirmUnnamed":
    "Sind Sie sicher, dass Sie diesen Cocktail löschen möchten?\n\nDiese Aktion kann nicht rückgängig gemacht werden.",
  "cocktailForm.deleteCocktail": "Cocktail löschen",
  "cocktailForm.couldNotDelete": "Cocktail konnte nicht gelöscht werden",
  "cocktailForm.leaveWithoutSaving": "Ohne Speichern verlassen?",
  "cocktailForm.leaveWithoutSavingMessage":
    "Ihre Änderungen gehen verloren, wenn Sie diesen Bildschirm verlassen.",
  "cocktailForm.stay": "Bleiben",
  "cocktailForm.leave": "Verlassen",
  "cocktailForm.name": "Name",
  "cocktailForm.namePlaceholder": "z. B. Margarita",
  "cocktailForm.glass": "Glas",
  "cocktailForm.selectGlassware": "Glas auswählen",
  "cocktailForm.photo": "Foto",
  "cocktailForm.tapToSelectImage": "Tippen, um ein Foto auszuwählen",
  "cocktailForm.removePhoto": "Foto entfernen",
  "cocktailForm.method": "Methode",
  "cocktailForm.selectMethod": "Methode auswählen",
  "cocktailForm.notSpecified": "Nicht angegeben",
  "cocktailForm.tags": "Tags",
  "cocktailForm.createTag": "Tag erstellen",
  "cocktailForm.selectTags": "Tags auswählen",
  "cocktailForm.description": "Beschreibung",
  "cocktailForm.optionalDescription": "Optionale Beschreibung",
  "cocktailForm.instructions": "Anleitung",
  "cocktailForm.instructionsPlaceholder": "1. Eis hinzufügen...",
  "cocktailForm.video": "Video",
  "cocktailForm.videoPlaceholder": "Videolink einfügen",
  "cocktailForm.defaultServings": "Standard-Portionen",
  "cocktailForm.ingredients": "Zutaten",
  "cocktailForm.addIngredient": "Zutat hinzufügen",
  "cocktailForm.saveCocktail": "Cocktail speichern",
  "cocktailForm.editCocktail": "Cocktail bearbeiten",
  "cocktailForm.close": "Schließen",
  "cocktailForm.selectGlass": "Glas auswählen",
  "cocktailForm.selectUnit": "Einheit auswählen",
  "cocktailForm.selectNamed": "{{name}} auswählen",
  "cocktailForm.selectEmptyUnit": "Leere Einheit auswählen",
  "cocktailForm.clearMethods": "Methoden löschen",
  "cocktailForm.clearMethodsDescription": "Alle ausgewählten Methoden löschen.",
  "cocktailForm.helpTitle": "Cocktail hinzufügen",
  "cocktailForm.helpMessage":
    "Verwenden Sie diesen Bildschirm, um ein neues Cocktailrezept zu erstellen.\n\nGeben Sie Name, Foto, Tags, Zutaten, Methode und Anleitung ein und tippen Sie dann auf Speichern.",
  "cocktailForm.newTag": "Neuer Tag",
  "cocktailForm.recipesCount": "{{count}} Rezepte",
  "cocktailForm.noUnit": "Keine Einheit",
  "cocktailForm.ingredientIndex": "{{index}}. Zutat",
  "cocktailForm.moveIngredientUp": "Zutat nach oben verschieben",
  "cocktailForm.moveIngredientDown": "Zutat nach unten verschieben",
  "cocktailForm.removeIngredient": "Zutat entfernen",
  "cocktailForm.ingredientName": "Zutatenname",
  "cocktailForm.createNewIngredient": "Neue Zutat erstellen",
  "cocktailForm.onShoppingList": "Auf der Einkaufsliste",
  "cocktailForm.amount": "Menge",
  "cocktailForm.unit": "Einheit",
  "cocktailForm.amountPlaceholder": "z. B. 45",
  "cocktailForm.garnish": "Dekoration",
  "cocktailForm.optional": "Optional",
  "cocktailForm.process": "Zubereitung",
  "cocktailForm.processMessage":
    "Kennzeichnet Eis für Zubereitungstechniken wie Shaken, Rühren oder Throwing.",
  "cocktailForm.serving": "Servieren",
  "cocktailForm.servingMessage":
    "Kennzeichnet Eis für den Service, einschließlich Blending, weil dieses Eis im Glas landet.",
  "cocktailForm.allowBaseSubstitute": "Basisersatz zulassen",
  "cocktailForm.allowBaseSubstituteMessage":
    "Wenn die angegebene Zutat nicht verfügbar ist, wird der Cocktail mit ihrer Basiszutat als verfügbar angezeigt.",
  "cocktailForm.allowBrandedSubstitute": "Markenersatz zulassen",
  "cocktailForm.allowBrandedSubstituteMessage":
    "Wenn die angegebene Zutat nicht verfügbar ist, wird der Cocktail mit markengebundenen Varianten der Basiszutat als verfügbar angezeigt.",
  "cocktailForm.allowStyleSubstitutes": "Stilersatz zulassen",
  "cocktailForm.allowStyleSubstitutesMessage":
    "Wenn die angegebene Stil-Zutat nicht verfügbar ist, wird der Cocktail mit ihrer Basis-Stil-Zutat oder anderen Stilen derselben Basis als verfügbar angezeigt.",
  "cocktailForm.addSubstitute": "Ersatz hinzufügen",
  "cocktailForm.brand": "Marke",
  "cocktailForm.removeNamed": "{{name}} entfernen",

  "cocktailDetails.title": "Cocktail-Details",
  "cocktailDetails.noPhoto": "Kein Foto",
  "cocktailDetails.clearRating": "Bewertung löschen",
  "cocktailDetails.setRatingTo": "Bewertung auf {{value}} setzen",
  "cocktailDetails.toggleComment": "Kommentar hinzufügen",
  "cocktailDetails.openVideos": "Videoanleitung öffnen",
  "cocktailDetails.commentPlaceholder":
    "Fügen Sie Ihren Kommentar hinzu. Er wird beim Verlassen dieses Bildschirms automatisch gespeichert.",
  "cocktailDetails.showInMetric": "In metrischen Einheiten anzeigen",
  "cocktailDetails.showInImperial": "Imperial anzeigen",
  "cocktailDetails.displayMode.imperial": "Imperial",
  "cocktailDetails.displayMode.metric": "Metrisch",
  "cocktailDetails.displayMode.parts": "Teile",
  "cocktailDetails.hideMethodDescription": "{{method}}-Beschreibung ausblenden",
  "cocktailDetails.showMethodDescription": "{{method}}-Beschreibung anzeigen",
  "cocktailDetails.tag": "Tag",
  "cocktailDetails.showLessDescription": "Weniger Beschreibung anzeigen",
  "cocktailDetails.showFullDescription": "Vollständige Beschreibung anzeigen",
  "cocktailDetails.showLess": "Weniger anzeigen",
  "cocktailDetails.showMore": "Mehr anzeigen",
  "cocktailDetails.instructions": "Anleitung",
  "cocktailDetails.ingredients": "Zutaten",

  "cocktailDetails.servings": "Portionen",
  "cocktailDetails.decreaseServings": "Portionen verringern",
  "cocktailDetails.increaseServings": "Portionen erhöhen",
  "cocktailDetails.asNeeded": "Nach Bedarf",
  "cocktailDetails.garnish": "Dekoration",
  "cocktailDetails.optional": "optional",
  "cocktailDetails.process": "Zubereitung",
  "cocktailDetails.serving": "Servieren",
  "cocktailDetails.or": "oder {{name}}",
  "cocktailDetails.orAny": "oder ein beliebiger {{name}}",
  "cocktailDetails.substituteFor": "Ersatz für {{name}}",
  "cocktailDetails.onShoppingList": "Auf der Einkaufsliste",
  "cocktailDetails.addCocktailIngredientsToShopping":
    "Cocktail-Zutaten zur Einkaufsliste hinzufügen",
  "cocktailDetails.buyAllIngredients": "Alle Zutaten kaufen",
  "cocktailDetails.copyCocktail": "Cocktail kopieren",
  "cocktailDetails.editCocktail": "Cocktail bearbeiten",
  "cocktailDetails.notFound": "Cocktail nicht gefunden",
  "cocktailDetails.helpMessage":
    "Dieser Bildschirm zeigt Cocktail-Details, Zutaten und Anleitung.\n\nVerwenden Sie die Schaltflächen unter dem Cocktail, um ihn zu kopieren oder zu bearbeiten.\n\n**Zutaten-Bänder**\nDas linke Band markiert die Zutatenart:\nblau = Markenzutat,\ngelb = Stil-Zutat.\n\nDas rechte Band markiert Basisvarianten:\nblau = hat markengebundene Varianten,\ngelb = hat Stil-Varianten.",

  "cocktailMethod.blend.label": "Mixen",
  "cocktailMethod.blend.description":
    "Mit Crushed Ice zu einer gefrorenen Textur mixen.",
  "cocktailMethod.muddle.label": "Stampfen",
  "cocktailMethod.muddle.description":
    "Früchte, Beeren oder Kräuter andrücken, um Öle und Saft freizusetzen.",
  "cocktailMethod.heat.label": "Erhitzen",
  "cocktailMethod.heat.description":
    "Zutaten sanft erwärmen, um Aromen zu verbinden, ohne zu kochen.",
  "cocktailMethod.shake.label": "Shaken",
  "cocktailMethod.shake.description":
    "Mit Eis schütteln. Am besten für Zitrus, Sirup, Sahne oder Eiweiß, um zu belüften und zu kühlen.",
  "cocktailMethod.stir.label": "Rühren",
  "cocktailMethod.stir.description":
    "Mit einem Barlöffel in einem mit Eis gefüllten Mixglas rühren. Am besten für klare, spirituosenbetonte Drinks.",
  "cocktailMethod.throw.label": "Umgießen",
  "cocktailMethod.throw.description":
    "Zwischen zwei Gefäßen hin- und hergießen, um sanft zu belüften, ohne zu stark zu verwässern.",
  "cocktailMethod.build.label": "Im Glas bauen",
  "cocktailMethod.build.description":
    "Zutaten direkt in das Servierglas geben.",
  "cocktailMethod.layer.label": "Schichten",
  "cocktailMethod.layer.description":
    "Zutaten mit einem Barlöffel in Schichten übereinandergeben, um einen optischen Effekt zu erzeugen.",

  "ingredientDetails.title": "Zutaten-Details",
  "ingredientDetails.goBack": "Zurück",
  "ingredientDetails.noPhoto": "Kein Foto",
  "ingredientDetails.iHaveIt": "Habe ich",
  "ingredientDetails.removeFromShoppingList": "Von der Einkaufsliste entfernen",
  "ingredientDetails.addToShoppingList": "Zur Einkaufsliste hinzufügen",
  "ingredientDetails.removeIngredientFromShoppingList":
    "Zutat von der Einkaufsliste entfernen",
  "ingredientDetails.addIngredientToShoppingList":
    "Zutat zur Einkaufsliste hinzufügen",
  "ingredientDetails.buyOnAmazon": "Bei {{store}} kaufen",
  "ingredientDetails.amazonAffiliateInformation": "Amazon-Partnerinformationen",
  "ingredientDetails.affiliateDisclosureTitle": "Hinweis zu Partnerlinks",
  "ingredientDetails.affiliateDisclosureMessage":
    "Einige Amazon-Links in dieser App sind Partnerlinks. Wenn Sie etwas kaufen, erhalten wir möglicherweise eine kleine Provision, ohne dass für Sie zusätzliche Kosten entstehen.\n\nDies hilft, die Entwicklung der App zu unterstützen.\nVielen Dank für Ihre Unterstützung!",
  "ingredientDetails.toMakeMoreCocktails.one":
    "für {{count}} weiteren Cocktail",
  "ingredientDetails.toMakeMoreCocktails.few":
    "für {{count}} weitere Cocktails",
  "ingredientDetails.toMakeMoreCocktails.many":
    "für {{count}} weitere Cocktails",
  "ingredientDetails.toMakeMoreCocktails.other":
    "für {{count}} weitere Cocktails",
  "ingredientDetails.tag": "Tag",
  "ingredientDetails.showLessDescription": "Weniger Beschreibung anzeigen",
  "ingredientDetails.showFullDescription": "Vollständige Beschreibung anzeigen",
  "ingredientDetails.showLess": "Weniger anzeigen",
  "ingredientDetails.showMore": "Mehr anzeigen",
  "ingredientDetails.styleIngredient": "Stil-Zutat",
  "ingredientDetails.viewStyleIngredient": "Stil-Zutat ansehen",
  "ingredientDetails.removeStyleIngredient": "Stil-Zutat entfernen",
  "ingredientDetails.baseIngredient": "Basiszutat",
  "ingredientDetails.viewBaseIngredient": "Basiszutat ansehen",
  "ingredientDetails.removeBaseIngredient": "Basiszutat entfernen",
  "ingredientDetails.secondarys": "Stil-Zutaten",
  "ingredientDetails.brandedIngredients": "Markenzutaten",
  "ingredientDetails.viewIngredient": "{{name}} ansehen",
  "ingredientDetails.removeIngredientLink": "Verknüpfung zu {{name}} entfernen",
  "ingredientDetails.filterCocktails": "Cocktails filtern",
  "ingredientDetails.cocktails": "Cocktails",
  "ingredientDetails.showMoreCocktails": "Weitere Cocktails anzeigen",
  "ingredientDetails.noCocktailsYet": "Noch keine Cocktails",
  "ingredientDetails.addCocktail": "Cocktail hinzufügen",
  "ingredientDetails.editIngredient": "Zutat bearbeiten",
  "ingredientDetails.notFound": "Zutat nicht gefunden",

  "ingredientDetails.notFoundSuggestion":
    "Diese Zutat existiert noch nicht. Sie können sie jetzt erstellen.",
  "ingredientDetails.createMissingIngredient": "Diese Zutat erstellen",
  "ingredientDetails.helpMessage":
    "Dieser Bildschirm zeigt Zutaten-Details, Verknüpfungen und zugehörige Cocktails.\n\nVerwenden Sie die Schaltfläche unter der Zutat, um sie zu bearbeiten.\n\n**Cocktail-Bänder**\nDas linke Band zeigt, was enthalten ist:\nblau = hat Markenzutaten,\ngelb = hat Stil-Zutaten.\n\nDas rechte Band zeigt Ersatzmöglichkeiten:\nblau = Markenersatz vorhanden,\ngelb = Stilersatz vorhanden.",
  "ingredientDetails.removeBaseTitle": "Basiszutat entfernen",
  "ingredientDetails.removeBaseMessage":
    "Sind Sie sicher, dass Sie die Verknüpfung von {{name}} mit der Basiszutat aufheben möchten?",
  "ingredientDetails.removeStyleTitle": "Stil-Zutat entfernen",
  "ingredientDetails.removeStyleMessage":
    "Sind Sie sicher, dass Sie die Verknüpfung von {{name}} mit der Stil-Zutat aufheben möchten?",
  "ingredientDetails.removeBrandedTitle": "Markenzutat entfernen",
  "ingredientDetails.removeBrandedMessage":
    "Verknüpfung von {{source}} mit {{target}} aufheben?",
  "ingredientDetails.removeStyledTitle": "Stil-Zutat entfernen",
  "ingredientDetails.removeStyledMessage":
    "Verknüpfung von {{source}} mit {{target}} aufheben?",
  "ingredientDetails.cancel": "Abbrechen",
  "ingredientDetails.remove": "Entfernen",

  "shaker.helpBase":
    "Dieser Bildschirm hilft Ihnen, Zutaten auszuwählen und zu verstehen, was Sie gerade mixen können.\n\nNutzen Sie die Suche, um Zutaten schnell zu finden, tippen Sie auf Zutaten, um sie auszuwählen, und öffnen Sie die Shaker-Ergebnisse für passende Cocktails.",
  "shaker.currentSelection": "Aktuelle Auswahl",
  "shaker.clearSelectedIngredients": "Ausgewählte Zutaten löschen",
  "shaker.cocktailsCount": "Cocktails: {{count}}",
  "shaker.recipesCount": "(Rezepte: {{count}})",
  "shaker.showMatchingRecipes": "Passende Rezepte anzeigen",

  "onboarding.start": "Start",
  "onboarding.next": "Weiter",
  "onboarding.finish": "Fertig",
  "onboarding.skip": "Überspringen",
  "onboarding.stepCounter": "{{current}} von {{total}}",
  "onboarding.step1.message":
    "**Willkommen!**\nLassen Sie uns Ihre Bar einrichten, indem Sie ein paar Zutaten hinzufügen.",
  "onboarding.step2.message":
    "Tippen Sie auf **Zutaten**, um mit dem Hinzufügen dessen zu beginnen, was Sie haben.",
  "onboarding.step3.message":
    "Hier ist die vollständige Zutatenliste.\nWir haben bereits ein paar gängige Grundzutaten für Sie markiert.",
  "onboarding.step4.message":
    "**Meine Zutaten** zeigt, was Sie besitzen.\nSie sehen auch, wie viele verfügbare Cocktails jede Zutat verwenden.",
  "onboarding.step5.message":
    "Schauen wir uns nun die Cocktails an.\nÖffnen Sie den Bildschirm **Cocktails**.",
  "onboarding.step6.message":
    "Oben auf **Meine Cocktails** sehen Sie Cocktails, die Sie jetzt machen können.\n\nDarunter sind Cocktails, denen nur eine Zutat fehlt.",
  "onboarding.step7.message":
    "Lernen Sie den **Shaker** kennen.\nEr hilft Ihnen, Cocktails basierend auf ausgewählten Zutaten zu finden.",
  "onboarding.step8.message":
    "**Shaker-Logik**\nZutaten aus derselben Kategorie können einander ersetzen (*ODER*).\nZutaten aus verschiedenen Kategorien werden zusammen benötigt (*UND*).\n\n**Beispiel**\n(Gin *ODER* Whiskey) *UND* (Cola *ODER* Tonic) *UND* (Zitrone *ODER* Limette).",
  "onboarding.step9.message":
    "Verwenden Sie diesen Schalter, um nur Zutaten anzuzeigen, die Sie besitzen.",
  "onboarding.step10.message":
    "Wählen Sie ein paar Zutaten aus und tippen Sie dann auf **Anzeigen**, um passende Cocktails zu sehen.",
  "onboarding.step11.message":
    "Beginnen Sie, indem Sie Zutaten, die Sie bereits besitzen, in **Alle Zutaten** markieren.\n\nProst!",

  "ingredients.emptyShopping":
    "Es befinden sich noch keine Zutaten auf Ihrer\nEinkaufsliste.",
  "ingredients.emptyList": "Keine Zutaten in der Liste",
  "ingredients.makeCount.one": "{{count}} Cocktail zubereiten",
  "ingredients.makeCount.other": "{{count}} Cocktails zubereiten",
  "ingredients.recipeCount.one": "{{count}} Rezept",
  "ingredients.recipeCount.other": "{{count}} Rezepte",
  "ingredients.helpAllFullText":
    "Dieser Bildschirm zeigt alle Zutaten in der App.\n\nNutzen Sie die Suche, wechseln Sie zwischen den Tabs und filtern Sie nach Tags.\n\nTippen Sie auf ein Kontrollkästchen, um die Verfügbarkeit zu markieren.",
  "ingredients.clearSelectedTagFilters": "Ausgewählte Tag-Filter löschen",
  "ingredients.addIngredient": "Zutat hinzufügen",

  "ingredients.sortBy": "Sortieren nach",
  "ingredients.sortOptionAlphabeticalAccessibility":
    "Zutaten alphabetisch sortieren",
  "ingredients.sortOptionUnlocksMostCocktailsAccessibility":
    "Zutaten nach Anzahl freigeschalteter Cocktails sortieren",
  "ingredients.sortOptionMostUsedAccessibility":
    "Zutaten nach Verwendungshäufigkeit sortieren",
  "ingredients.sortOptionRecentlyAddedAccessibility":
    "Zutaten nach zuletzt hinzugefügt sortieren",

  "cocktails.oneMoreIngredientForMore":
    "↓ Noch eine Zutat für mehr Cocktails ↓",
  "cocktails.removeIngredientFromShopping":
    "Zutat von der Einkaufsliste entfernen",
  "cocktails.addIngredientToShopping": "Zutat zur Einkaufsliste hinzufügen",
  "cocktails.buyNamed": "{{name}} kaufen",
  "cocktails.toMakeMore.one": "für {{count}} weiteren Cocktail",
  "cocktails.toMakeMore.few": "für {{count}} weitere Cocktails",
  "cocktails.toMakeMore.many": "für {{count}} weitere Cocktails",
  "cocktails.toMakeMore.other": "für {{count}} weitere Cocktails",
  "cocktails.collapseIngredientGroup": "{{name}}-Cocktails einklappen",
  "cocktails.expandIngredientGroup": "{{name}}-Cocktails ausklappen",
  "cocktails.clearSelectedFilters": "Ausgewählte Filter löschen",

  "cocktails.sortBy": "Sortieren nach",
  "cocktails.sortOptionAlphabeticalAccessibility":
    "Alphabetisch sortieren (A–Z)",
  "cocktails.sortOptionPartySelectedAccessibility":
    "Nach Partyauswahl sortieren",
  "cocktails.sortOptionRequiredCountAccessibility":
    "Nach Anzahl benötigter Zutaten sortieren",
  "cocktails.sortOptionMissingRequiredCountAccessibility":
    "Nach Anzahl fehlender benötigter Zutaten sortieren",
  "cocktails.sortOptionRatingAccessibility": "Nach Bewertung sortieren",
  "cocktails.sortOptionRecentlyAddedAccessibility":
    "Nach Hinzufügedatum sortieren",
  "cocktails.sortOptionRandomAccessibility": "Zufällig sortieren",
  "cocktails.addCocktail": "Cocktail hinzufügen",
  "cocktails.addPartyIngredientsToShopping":
    "Zutaten ausgewählter Cocktails zur Einkaufsliste hinzufügen",

  "shakerResults.helpTitle": "Shaker-Ergebnisse",
  "shakerResults.helpText":
    "Dieser Bildschirm zeigt Cocktails, die Sie mit den ausgewählten Zutaten zubereiten können.\n\nNutzen Sie Suche und Filter, um die Ergebnisse einzugrenzen, und öffnen Sie dann einen Cocktail, um Rezeptdetails und Zubereitungsschritte anzuzeigen.",
  "shakerResults.clearSelectedFilters": "Ausgewählte Filter löschen",

  "shakerResults.sortBy": "Sortieren nach",
  "shakerResults.sortOptionAlphabetical": "Alphabetisch (A–Z)",
  "shakerResults.sortOptionRequiredCount": "Anzahl benötigter Zutaten",
  "shakerResults.sortOptionMissingRequiredCount":
    "Anzahl fehlender benötigter Zutaten",
  "shakerResults.sortOptionRating": "Bewertung",
  "shakerResults.sortOptionRecentlyAdded": "Zuletzt hinzugefügt",
  "shakerResults.sortOptionRandom": "Zufällig",
  "shakerResults.emptyMatchingRecipes": "Keine passenden Rezepte",

  "cocktailListRow.allIngredientsReady": "Alle Zutaten bereit",

  "tabBar.leaveWithoutSavingTitle": "Ohne Speichern verlassen?",
  "tabBar.leaveWithoutSavingMessage":
    "Ihre Änderungen gehen verloren, wenn Sie diesen Bildschirm verlassen.",

  "substituteModal.forNamed": "Für {{name}}",
  "substituteModal.searchIngredients": "Zutaten suchen",

  "tagEditor.tagName": "Tag-Name",
  "tagEditor.newTag": "Neuer Tag",
  "tagEditor.color": "Farbe",

  "tags.unnamed": "Unbenannter Tag",
  "tabs.cocktails": "Cocktails",
  "tabs.shaker": "Shaker",
  "tabs.ingredients": "Zutaten",

  "sideMenu.settingsTitle": "Einstellungen",
  "sideMenu.bars": "Meine Bars",
  "sideMenu.manageBars": "Bars verwalten",
  "sideMenu.ignoreGarnish": "Dekoration ignorieren",
  "sideMenu.ignoreGarnishCaption": "Alle Dekorationen sind optional",
  "sideMenu.allowAllSubstitutes": "Alle Ersatzoptionen zulassen",
  "sideMenu.allowAllSubstitutesCaption": "Ersatz immer berücksichtigen",
  "sideMenu.useImperial": "Imperial anzeigen",
  "sideMenu.useImperialCaption": "oz statt ml und g verwenden",
  "sideMenu.keepScreenAwake": "Bildschirm aktiv halten",
  "sideMenu.keepScreenAwakeCaption":
    "Bildschirmsperre in der Cocktailansicht verhindern",
  "sideMenu.smartShakerFiltering": "Intelligenter Filter",
  "sideMenu.smartShakerFilteringInfo":
    "Info zur intelligenten Shaker-Filterung",
  "sideMenu.smartShakerFilteringInfoTitle": "Intelligente Shaker-Filterung",
  "sideMenu.smartShakerFilteringInfoMessage":
    "Wenn aktiviert, werden Zutaten in Gruppen ohne aktuelle Auswahl ausgeblendet, wenn sie keine Ergebnisse liefern würden.\n\nIn Gruppen, in denen Sie bereits mindestens eine Zutat ausgewählt haben, bleiben Elemente sichtbar, um die ODER-Logik beizubehalten.\n\nDeaktivieren Sie dies, um das Standardverhalten des Shakers wiederherzustellen.",
  "sideMenu.smartShakerFilteringCaption": "Nicht passende Zutaten ausblenden",
  "sideMenu.showTabCounters": "Anzahl anzeigen",
  "sideMenu.showTabCountersCaption": "Anzahl neben Tabs anzeigen",
  "sideMenu.startingScreen": "Startbildschirm",
  "sideMenu.startingScreenOpen": "{{screen}} öffnen",
  "sideMenu.manageTags": "Tags verwalten",
  "sideMenu.manageTagsCaption": "Erstellen oder aktualisieren Sie Ihre Tags",
  "sideMenu.cocktailTags": "Cocktail-Tags",
  "sideMenu.ingredientTags": "Zutaten-Tags",
  "sideMenu.noCustomCocktailTags":
    "Noch keine benutzerdefinierten Cocktail-Tags.",
  "sideMenu.noCustomIngredientTags":
    "Noch keine benutzerdefinierten Zutaten-Tags.",
  "sideMenu.editNamedTagA11y": "{{name}} bearbeiten",
  "sideMenu.deleteNamedTagA11y": "{{name}} löschen",
  "sideMenu.tagFallbackName": "Tag",
  "sideMenu.startScreenModalDescription":
    "Wählen Sie, wo die App geöffnet wird.",
  "sideMenu.startScreenOptionA11y": "Zuerst {{screen}} öffnen",
  "sideMenu.amazonStoreModalDescription":
    "Überschreiben Sie die automatische Erkennung, um Ihren bevorzugten Amazon-Store auszuwählen.",
  "sideMenu.amazonStoreAutomatic": "Automatisch",
  "sideMenu.amazonStoreDetected": "Erkannt: {{store}}",
  "sideMenu.amazonStoreUnknown": "Unbekannt",
  "sideMenu.amazonStoreSetToA11y": "Amazon-Store auf {{store}} setzen",
  "sideMenu.amazonStoreDisabled": "Deaktiviert",
  "sideMenu.amazonStoreHideLink": "„Bei Amazon kaufen“-Link ausblenden",
  "sideMenu.version": "Version {{version}}",
  "settings.disabled": "Deaktiviert",
  "sideMenu.closeMenu": "Menü schließen",
  "sideMenu.amazonStore": "Amazon-Store",
  "sideMenu.amazonStoreCurrent": "Aktuell: {{label}}",
  "sideMenu.language": "App-Sprache",
  "sideMenu.languageCurrent": "{{name}}",
  "sideMenu.reportIssueTitle": "Etwas nicht in Ordnung?",
  "sideMenu.reportIssueCaption": "Fehler melden, Idee teilen",
  "sideMenu.rateAppTitle": "Gefällt Ihnen Your Bar?",
  "sideMenu.rateAppCaption": "Bewerten Sie Your Bar!",
  "sideMenu.backupRestore": "Sichern & Wiederherstellen",
  "sideMenu.backupRestoreCaption":
    "Daten speichern, aus Backup wiederherstellen",
  "sideMenu.restartOnboarding": "Einführung neu starten",
  "sideMenu.restartOnboardingCaption": "Das geführte Tutorial erneut anzeigen",

  "barManager.title": "Meine Bars",
  "barManager.subtitle": "Bars verwalten",
  "barManager.createBar": "Bar erstellen",
  "barManager.renameBar": "Bar umbenennen",
  "barManager.deleteBar": "Bar löschen",
  "barManager.barName": "Bar-Name",
  "barManager.deleteConfirm":
    'Sind Sie sicher, dass Sie die Bar \n **"{{name}}"** löschen möchten?',
  "barManager.cannotDeleteLast": "Sie können Ihre einzige Bar nicht löschen.",
  "barManager.defaultName": "Zuhause",

  "app.loadingTagline": "Ihre Bar. Ihre Regeln!",
  "appDialog.closeDialog": "Dialog schließen",
  "tagEditor.hue": "Farbton",
  "tagEditor.tone": "Ton",

  "sideMenu.restore": "Wiederherstellen",
  "sideMenu.restoreBundledData": "Mitgelieferte Daten wiederherstellen",
  "sideMenu.restoreBundledDataDescription":
    "Mitgelieferte Änderungen gehen verloren. Ihre eigenen Inhalte bleiben sicher.",
  "sideMenu.restoreBundledDataConfirmMessage":
    "Dies stellt die mitgelieferten Cocktails und Zutaten wieder her.\nIhre eigenen Cocktails und Zutaten bleiben unverändert.",
  "sideMenu.exportUnavailableTitle": "Export nicht verfügbar",
  "sideMenu.exportUnavailableMessage":
    "Laden Sie Ihr Inventar, bevor Sie es exportieren.",
  
  "sideMenu.cloudSync": "Cloud-Sync",
  "sideMenu.cloudSyncSignIn": "Bei Google Drive anmelden",
  "sideMenu.cloudSyncSignedIn": "Google Drive verbunden",
  "sideMenu.cloudSyncCaption": "Synchronisiert Bars, Cocktails, Zutaten, Bewertungen, Einkauf und Einstellungen",
  "sideMenu.cloudSyncAuto": "Auto-Sync läuft beim App-Start",
  "sideMenu.cloudSyncing": "Synchronisiere mit Google Drive…",
  "sideMenu.cloudSyncSignOut": "Von Cloud-Sync abmelden",
"sideMenu.backupUnavailableTitle": "Sicherung nicht verfügbar",
  "sideMenu.backupUnavailableMessage":
    "Laden Sie Ihr Inventar, bevor Sie Daten sichern.",
  "sideMenu.sharingUnavailableTitle": "Teilen nicht verfügbar",
  "sideMenu.sharingUnavailableMessage":
    "Teilen ist auf diesem Gerät nicht verfügbar.",
  "sideMenu.exportFailedTitle": "Export fehlgeschlagen",
  "sideMenu.backupFailedTitle": "Sicherung fehlgeschlagen",
  "sideMenu.importFailedTitle": "Import fehlgeschlagen",
  "sideMenu.deviceStorageUnavailable":
    "Auf den Gerätespeicher kann nicht zugegriffen werden.",
  "sideMenu.importReadArchiveFailed":
    "Das ausgewählte Archiv kann nicht gelesen werden.",
  "sideMenu.importArchiveEmpty": "Das ausgewählte Archiv ist leer.",
  "sideMenu.importMissingInventory":
    "Dem Sicherungsarchiv fehlen Inventardaten.",
  "sideMenu.importInvalidInventory":
    "Das Sicherungsarchiv enthält ungültige Inventardaten.",
  "sideMenu.importRetryWithValidArchive":
    "Bitte versuchen Sie es erneut mit einem gültigen Sicherungsarchiv.",

  "sideMenu.importIngredientStatusesTitle": "Zutatenstatus importieren?",
  "sideMenu.importIngredientStatusesMessage":
    "Wählen Sie aus, welche Zutatenstatus aus diesem Backup importiert werden sollen.",
  "sideMenu.importIngredientStatusesAvailability": "Zutatenverfügbarkeit",
  "sideMenu.importIngredientStatusesShopping": "Einkaufsliste für Zutaten",
  "sideMenu.importIngredientStatusesConfirm": "Auswahl importieren",
  "sideMenu.deleteTagTitle": "Tag löschen",
  "sideMenu.deleteTagMessage": '"{{name}}" entfernen?',
  "sideMenu.emailUnavailableTitle": "E-Mail kann nicht geöffnet werden",
  "sideMenu.emailUnavailableMessage":
    "Bitte senden Sie Ihren Bericht manuell an your.bar.app@gmail.com.",
  "sideMenu.useAutomaticAmazonStoreDetection":
    "Automatische Amazon-Store-Erkennung verwenden",
  "sideMenu.disableAmazonLink": "Amazon-Link deaktivieren",
  "sideMenu.backupData": "Daten sichern",
  "sideMenu.backingUpData": "Daten werden gesichert...",
  "sideMenu.backupDataDescription":
    "Exportieren Sie Cocktails, Zutaten und Fotos als einzelnes Archiv.",
  "sideMenu.restoreData": "Daten wiederherstellen",
  "sideMenu.restoringData": "Daten werden wiederhergestellt...",
  "sideMenu.restoreDataDescription":
    "Importieren Sie Cocktails, Zutaten und Fotos aus einem Archiv.",
  "sideMenu.reloadBundledInventory": "Mitgeliefertes Inventar neu laden",
  "language.en-GB": "Englisch",
  "language.en-US": "Englisch (US)",
  "language.uk-UA": "Ukrainisch",
  "language.es-ES": "Spanisch",
  "language.de-DE": "Deutsch (Beta)",
  "languageModal.title": "App-Sprache",
  "languageModal.description":
    "Änderungen werden sofort übernommen.\nMitgelieferte Daten werden übersetzt.",
  "languageModal.close": "Schließen",
  "languageModal.selectLanguage": "Sprache auf {{name}} setzen",

  "startScreen.cocktails_all.label": "Alle Cocktails",
  "startScreen.cocktails_all.description": "Alle Rezepte durchstöbern",
  "startScreen.cocktails_my.label": "Meine Cocktails",
  "startScreen.cocktails_my.description":
    "Verfügbare Cocktails zuerst anzeigen",
  "startScreen.shaker.label": "Shaker",
  "startScreen.shaker.description": "Cocktails nach Zutaten finden",
  "startScreen.ingredients_all.label": "Alle Zutaten",
  "startScreen.ingredients_all.description": "Jede Zutat verwalten",
  "startScreen.ingredients_my.label": "Meine Zutaten",
  "startScreen.ingredients_my.description":
    "Beginnen Sie mit dem, was Sie besitzen",
  "startScreen.ingredients_shopping.label": "Einkaufsliste",
  "startScreen.ingredients_shopping.description":
    "Zu Ihren Einkaufsartikeln gehen",

  "theme.light": "Hell",
  "theme.dark": "Dunkel",
  "theme.system": "System",

  "glassware.bowl": "Schale",
  "glassware.flute_glass": "Sektflöte",
  "glassware.martini": "Martiniglas",
  "glassware.collins_glass": "Collins-Glas",
  "glassware.copper_mug": "Kupferbecher",
  "glassware.coupe": "Coupe-Glas",
  "glassware.cup": "Tasse",
  "glassware.goblet": "Kelch",
  "glassware.highball_glass": "Highball-Glas",
  "glassware.hurricane_glass": "Hurricane-Glas",
  "glassware.toddy_glass": "Hot-Toddy-Glas",
  "glassware.margarita_glass": "Margaritaglas",
  "glassware.nick_and_nora": "Nick & Nora",
  "glassware.pitcher": "Krug",
  "glassware.pub_glass": "Pintglas",
  "glassware.rocks_glass": "Old-Fashioned-Glas",
  "glassware.shooter": "Shotglas",
  "glassware.snifter": "Schwenker",
  "glassware.tiki_glass": "Tiki-Glas",
  "glassware.wine_glass": "Weinglas",

  "unit.1.singular": "",
  "unit.1.plural": "",
  "unit.2.singular": "Barlöffel",
  "unit.2.plural": "Barlöffel",
  "unit.3.singular": "cl",
  "unit.3.plural": "cl",
  "unit.4.singular": "Würfel",
  "unit.4.plural": "Würfel",
  "unit.5.singular": "Tasse",
  "unit.5.plural": "Tassen",
  "unit.6.singular": "Spritzer",
  "unit.6.plural": "Spritzer",
  "unit.7.singular": "Tropfen",
  "unit.7.plural": "Tropfen",
  "unit.8.singular": "g",
  "unit.8.plural": "g",
  "unit.9.singular": "Hälfte",
  "unit.9.plural": "Hälften",
  "unit.10.singular": "Blatt",
  "unit.10.plural": "Blätter",
  "unit.11.singular": "ml",
  "unit.11.plural": "ml",
  "unit.12.singular": "oz",
  "unit.12.plural": "oz",
  "unit.13.singular": "Teil",
  "unit.13.plural": "Teile",
  "unit.14.singular": "Schale (Abrieb)",
  "unit.14.plural": "Schalen (Abrieb)",
  "unit.15.singular": "Prise",
  "unit.15.plural": "Prisen",
  "unit.16.singular": "Viertel",
  "unit.16.plural": "Viertel",
  "unit.17.singular": "Kugel (Eis)",
  "unit.17.plural": "Kugeln (Eis)",
  "unit.18.singular": "Späne (Schokolade)",
  "unit.18.plural": "Späne (Schokolade)",
  "unit.19.singular": "Scheibe",
  "unit.19.plural": "Scheiben",
  "unit.20.singular": "Schuss",
  "unit.20.plural": "Schüsse",
  "unit.21.singular": "Zweig",
  "unit.21.plural": "Zweige",
  "unit.22.singular": "Stiel",
  "unit.22.plural": "Stiele",
  "unit.23.singular": "Esslöffel",
  "unit.23.plural": "Esslöffel",
  "unit.24.singular": "Teelöffel",
  "unit.24.plural": "Teelöffel",
  "unit.25.singular": "Drittel",
  "unit.25.plural": "Drittel",
  "unit.26.singular": "Zeste (gedreht)",
  "unit.26.plural": "Zesten (gedreht)",
  "unit.27.singular": "Spalte",
  "unit.27.plural": "Spalten",

  "ingredientTag.0": "Basisspirituosen",
  "ingredientTag.1": "Liköre",
  "ingredientTag.2": "Wein & Wermut",
  "ingredientTag.3": "Bier & Cider",
  "ingredientTag.4": "Bitter",
  "ingredientTag.5": "Sirup",
  "ingredientTag.6": "Mixer",
  "ingredientTag.7": "Obst, Gemüse & Saft",
  "ingredientTag.8": "Kühlschrank & Vorrat",
  "ingredientTag.9": "Sonstiges",

  "cocktailTag.1": "IBA offiziell",
  "cocktailTag.2": "Gleiche Teile",
  "cocktailTag.3": "Bitter",
  "cocktailTag.4": "Tiki",
  "cocktailTag.5": "Stark",
  "cocktailTag.6": "Mittelstark",
  "cocktailTag.7": "Mild",
  "cocktailTag.8": "Longdrink",
  "cocktailTag.9": "Shot",
  "cocktailTag.10": "Alkoholfrei",
  "cocktailTag.11": "Eigenes",

  "sideMenu.setThemeA11y": "{{theme}}-Design festlegen",
  "sideMenu.reportIssueSubject": "Etwas stimmt nicht in Your Bar",
  "ingredients.onShoppingList": "Auf der Einkaufsliste",
  "ingredients.removeFromShoppingList": "Von der Einkaufsliste entfernen",
  "shaker.ingredientsCount": "{{count}} Zutaten",
  "shaker.ingredientsInGroupA11y": "{{name}} Zutaten",
  "shaker.makeCount.one": "{{count}} Cocktail zubereiten",
  "shaker.makeCount.other": "{{count}} Cocktails zubereiten",
  "shaker.recipeCount.one": "{{count}} Rezept",
  "shaker.recipeCount.other": "{{count}} Rezepte",

  "cocktails.missingCount.one": "Fehlt: {{count}} Zutat",
  "cocktails.missingCount.other": "Fehlen: {{count}} Zutaten",
  "cocktails.missingNames": "Fehlen: {{names}}",

  "amazon.country.US": "USA",
  "amazon.country.UK": "Vereinigtes Königreich",
  "amazon.country.DE": "Deutschland",
  "amazon.country.FR": "Frankreich",
  "amazon.country.IT": "Italien",
  "amazon.country.ES": "Spanien",
  "amazon.country.CA": "Kanada",
  "amazon.country.JP": "Japan",
  "barcode.scanBarcode": "Barcode scannen",
  "barcode.cameraPermissionNeeded": "Kameraberechtigung erforderlich",
  "barcode.productAlreadyExists": "Produkt existiert bereits",
  "barcode.openExisting": "Vorhandenes öffnen",
  "barcode.createDuplicate": "Duplikat erstellen",
  "barcode.weFoundProduct": "Wir haben ein Produkt gefunden",
  "barcode.similarProductFound": "Dies ähnelt einer vorhandenen Zutat",
  "barcode.addBarcodeToExisting": "Barcode zu vorhandener Zutat hinzufügen",
  "barcode.createNewIngredient": "Neue Zutat erstellen",
  "barcode.createIngredient": "Zutat erstellen",
  "barcode.productNotFound": "Produkt nicht gefunden",
  "barcode.createManually": "Manuell erstellen",
  "barcode.scanAgain": "Erneut scannen",
  "barcode.editBeforeSaving": "Vor dem Speichern bearbeiten",
  "barcode.loadingProductInfo": "Produktinformationen werden geladen",
  "barcode.helpTitle": "Hilfe zum Barcode-Scanner",
  "barcode.helpMessage":
    "Richten Sie Ihre Kamera auf einen Produkt-Barcode. Wir prüfen, ob er bereits existiert, schlagen ähnliche Zutaten vor und lassen Sie ihn sicher erstellen oder verknüpfen.",
  "barcode.scannerUnavailable":
    "Der Barcode-Scanner ist in diesem Build nicht verfügbar",
  "common.back": "Zurück",
  "common.somethingWentWrong": "Etwas ist schiefgelaufen",
  "common.tryAgain": "Erneut versuchen",
};
