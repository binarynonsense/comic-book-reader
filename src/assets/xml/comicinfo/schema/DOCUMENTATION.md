# Schema documentation

This page aims at clarifying the various elements of the schema, as well as their intended use and observed usage.

### Title

Title of the book.

### Series

Title of the series the book is part of.

### Number

Number of the book in the series.

### Count

The total number of books in the series.

The `Count` could be different on each book in a series. Consuming applications should consider using only the value for the latest book in the series.

### Volume

Volume containing the book. Volume is a notion that is specific to US Comics, where the same series can have multiple volumes. Volumes can be referenced by numer (1, 2, 3…) or by year (2018, 2020…).

### AlternateSeries / AlternateNumber / AlternateCount

Quite specific to US comics, some books can be part of cross-over story arcs. Those fields can be used to specify an alternate series, its number and count of books.

### Summary

A description or summary of the book.

### Notes

A free text field, usually used to store information about the application that created the `ComicInfo.xml` file.

### Year / Month / Day

Usually contains the release date of the book.

### Creator fields

According to the schema, each creator element can only be present once. In order to cater for multiple creator with the same role, it is accepted that values are comma separated.

#### Writer

Person or organization responsible for creating the scenario.

#### Penciller

Person or organization responsible for drawing the art.

#### Inker

Person or organization responsible for inking the pencil art.

#### Colorist

Person or organization responsible for applying color to drawings.

#### Letterer

Person or organization responsible for drawing text and speech bubbles.

#### CoverArtist

Person or organization responsible for drawing the cover art.

#### Editor

A person or organization contributing to a resource by revising or elucidating the content, e.g., adding an introduction, notes, or other critical matter. An editor may also prepare a resource for production, publication, or distribution.

#### Translator

A person or organization who renders a text from one language into another, or from an older form of a language into the modern form.

This can also be used for fan translations ("scanlator"). 

### Publisher

A person or organization responsible for publishing, releasing, or issuing a resource.

### Imprint

An imprint is a group of publications under the umbrella of a larger imprint or a Publisher. For example, Vertigo is an Imprint of DC Comics.

### Genre

Genre of the book or series. For example, _Science-Fiction_ or _Shonen_.

It is accepted that multiple values are comma separated.

### Tags

Tags of the book or series. For example, _ninja_ or _school life_.

It is accepted that multiple values are comma separated.

### Web

A URL pointing to a reference website for the book.

### PageCount

The number of pages in the book.

### LanguageISO

A language code describing the language of the book.

Without any information on what kind of code this element is supposed to contain, it is recommended to use the [IETF BCP 47 language tag](https://en.wikipedia.org/wiki/IETF_language_tag), which can describe the language but also the script used. This helps to differentiate languages with multiple scripts, like Traditional and Simplified Chinese.

### Format

The original publication's binding format for scanned physical books or presentation format for digital sources.

"TBP", "HC", "Web", "Digital" are common designators.


### BlackAndWhite

Whether the book is in black and white.

### Manga

Whether the book is a manga. This also defines the reading direction as right-to-left when set to `YesAndRightToLeft`.

### Characters

Characters present in the book.

It is accepted that multiple values are comma separated.

### Teams

Teams present in the book. Usually refer to super-hero teams (e.g. Avengers).

It is accepted that multiple values are comma separated.

### Locations

Locations mentioned in the book.

It is accepted that multiple values are comma separated.

### MainCharacterOrTeam

Main character or team mentioned in the book.

It is accepted that a single value should be present.

### ScanInformation

A free text field, usually used to store information about who scanned the book.

### StoryArc

The story arc that books belong to.

For example, for [Undiscovered Country](https://comicvine.gamespot.com/undiscovered-country/4050-122630/), issues 1-6 are part of the _Destiny_ story arc, issues 7-12 are part of the _Unity_ story arc.

### StoryArcNumber

 While `StoryArc` was originally designed to store the arc _within a series_, it was often used to indicate that a book was part of a reading order, composed of books from multiple series. Mylar for instance was using the field as such.
 
Since `StoryArc` itself wasn't able to carry the information about ordering of books within a reading order, `StoryArcNumber` was added.

`StoryArc` and `StoryArcNumber` can work in combination, to indicate in which position the book is located at for a specific reading order.

It is accepted that multiple values can be specified for both `StoryArc` and `StoryArcNumber`. Multiple values are comma separated.

### SeriesGroup

A group or collection the series belongs to.

It is accepted that multiple values are comma separated.

### AgeRating

Age rating of the book.

### CommunityRating

Community rating of the book, from `0.0` to `5.0`.

### Review

Review of the book.

### GTIN

A [Global Trade Item Number](https://en.wikipedia.org/wiki/Global_Trade_Item_Number) identifying the book. GTIN incorporates other standards like ISBN, ISSN, EAN, or JAN.

### Pages / ComicPageInfo

Describes each page of the book.

#### Image

Page number.

#### Type

Type of the page:
- FrontCover
- InnerCover: sometimes found inside the book as a second cover
- Roundup: summary of previous issues
- Story
- Advertisement
- Editorial
- Letters: fan letters
- Preview: sneak preview of the next book, or another comic
- BackCover
- Other: for anything not covered above
- Delete: indicate that the page should not be shown by readers

#### DoublePage

Whether the page is a double spread.

#### ImageSize

File size of the image, supposedly in bytes.

#### Key

???

#### Bookmark

ComicRack uses this field when adding a bookmark in a book.

#### ImageWidth / ImageHeight

Width and height of the image in pixels.
