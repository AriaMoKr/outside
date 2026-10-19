// The book on the bench: a little anthology about water, for reading by the pond. All of it is in
// the public domain. Thoreau's passage is Project Gutenberg's Walden (ebook 205); the poems are as
// Wikisource has them from their first or early printed editions, named with each piece.

export const BOOK_TITLE = 'By the Water';
export const BOOK_SUBTITLE = 'Prose and verse for a garden bench';

/**
 * The pieces, in order: { title, author, source (the edition), kind: 'prose' (paragraphs) | 'verse'
 * (stanzas, a blank line between them), text }.
 */
export const PIECES = [
  {
    title: 'The Ponds',
    author: 'Henry David Thoreau',
    source: 'from Walden; or, Life in the Woods (1854)',
    kind: 'prose',
    text: `A lake is the landscape’s most beautiful and expressive feature. It is earth’s eye; looking into which the beholder measures the depth of his own nature. The fluviatile trees next the shore are the slender eyelashes which fringe it, and the wooded hills and cliffs around are its overhanging brows.

Standing on the smooth sandy beach at the east end of the pond, in a calm September afternoon, when a slight haze makes the opposite shore line indistinct, I have seen whence came the expression, “the glassy surface of a lake.” When you invert your head, it looks like a thread of finest gossamer stretched across the valley, and gleaming against the distant pine woods, separating one stratum of the atmosphere from another. You would think that you could walk dry under it to the opposite hills, and that the swallows which skim over might perch on it. Indeed, they sometimes dive below this line, as it were by mistake, and are undeceived. As you look over the pond westward you are obliged to employ both your hands to defend your eyes against the reflected as well as the true sun, for they are equally bright; and if, between the two, you survey its surface critically, it is literally as smooth as glass, except where the skater insects, at equal intervals scattered over its whole extent, by their motions in the sun produce the finest imaginable sparkle on it, or, perchance, a duck plumes itself, or, as I have said, a swallow skims so low as to touch it. It may be that in the distance a fish describes an arc of three or four feet in the air, and there is one bright flash where it emerges, and another where it strikes the water; sometimes the whole silvery arc is revealed; or here and there, perhaps, is a thistle-down floating on its surface, which the fishes dart at and so dimple it again. It is like molten glass cooled but not congealed, and the few motes in it are pure and beautiful like the imperfections in glass. You may often detect a yet smoother and darker water, separated from the rest as if by an invisible cobweb, boom of the water nymphs, resting on it. From a hill-top you can see a fish leap in almost any part; for not a pickerel or shiner picks an insect from this smooth surface but it manifestly disturbs the equilibrium of the whole lake. It is wonderful with what elaborateness this simple fact is advertised,—this piscine murder will out,—and from my distant perch I distinguish the circling undulations when they are half a dozen rods in diameter. You can even detect a water-bug (Gyrinus) ceaselessly progressing over the smooth surface a quarter of a mile off; for they furrow the water slightly, making a conspicuous ripple bounded by two diverging lines, but the skaters glide over it without rippling it perceptibly. When the surface is considerably agitated there are no skaters nor water-bugs on it, but apparently, in calm days, they leave their havens and adventurously glide forth from the shore by short impulses till they completely cover it. It is a soothing employment, on one of those fine days in the fall when all the warmth of the sun is fully appreciated, to sit on a stump on such a height as this, overlooking the pond, and study the dimpling circles which are incessantly inscribed on its otherwise invisible surface amid the reflected skies and trees. Over this great expanse there is no disturbance but it is thus at once gently smoothed away and assuaged, as, when a vase of water is jarred, the trembling circles seek the shore and all is smooth again. Not a fish can leap or an insect fall on the pond but it is thus reported in circling dimples, in lines of beauty, as it were the constant welling up of its fountain, the gentle pulsing of its life, the heaving of its breast. The thrills of joy and thrills of pain are undistinguishable. How peaceful the phenomena of the lake! Again the works of man shine as in the spring. Ay, every leaf and twig and stone and cobweb sparkles now at mid-afternoon as when covered with dew in a spring morning. Every motion of an oar or an insect produces a flash of light; and if an oar falls, how sweet the echo!`,
  },
  {
    title: 'The Brook',
    author: 'Alfred Tennyson',
    source: 'the brook’s song, from “The Brook,” in Maud, and Other Poems (1855)',
    kind: 'verse',
    text: `I come from haunts of coot and hern,
I make a sudden sally
And sparkle out among the fern,
To bicker down a valley.

By thirty hills I hurry down,
Or slip between the ridges,
By twenty thorps, a little town,
And half a hundred bridges.

Till last by Philip’s farm I flow
To join the brimming river,
For men may come and men may go,
But I go on for ever.

I chatter over stony ways,
In little sharps and trebles,
I bubble into eddying bays,
I babble on the pebbles.

With many a curve my banks I fret
By many a field and fallow,
And many a fairy foreland set
With willow-weed and mallow.

I chatter, chatter, as I flow
To join the brimming river,
For men may come and men may go,
But I go on for ever.

I wind about, and in and out,
With here a blossom sailing,
And here and there a lusty trout,
And here and there a grayling,

And here and there a foamy flake
Upon me, as I travel
With many a silvery waterbreak
Above the golden gravel,

And draw them all along, and flow
To join the brimming river,
For men may come and men may go,
But I go on for ever.

I steal by lawns and grassy plots,
I slide by hazel covers;
I move the sweet forget-me-nots
That grow for happy lovers.

I slip, I slide, I gloom, I glance,
Among my skimming swallows;
I make the netted sunbeam dance
Against my sandy shallows.

I murmur under moon and stars
In brambly wildernesses;
I linger by my shingly bars;
I loiter round my cresses;

And out again I curve and flow
To join the brimming river,
For men may come and men may go,
But I go on for ever.`,
  },
  {
    title: 'Where Go the Boats?',
    author: 'Robert Louis Stevenson',
    source: 'from A Child’s Garden of Verses (1885)',
    kind: 'verse',
    text: `Dark brown is the river,
Golden is the sand.
It flows along for ever,
With trees on either hand.

Green leaves a-floating,
Castles of the foam,
Boats of mine a-boating—
Where will all come home?

On goes the river
And out past the mill,
Away down the valley,
Away down the hill.

Away down the river,
A hundred miles or more,
Other little children
Shall bring my boats ashore.`,
  },
  {
    title: 'Inversnaid',
    author: 'Gerard Manley Hopkins',
    source: 'written 1881; from Poems of Gerard Manley Hopkins (1918)',
    kind: 'verse',
    text: `This darksome burn, horseback brown,
His rollrock highroad roaring down,
In coop and in comb the fleece of his foam
Flutes and low to the lake falls home.

A windpuff-bonnet of fáwn-fróth
Turns and twindles over the broth
Of a pool so pitchblack, féll-frówning,
It rounds and rounds Despair to drowning.

Degged with dew, dappled with dew
Are the groins of the braes that the brook treads through,
Wiry heathpacks, flitches of fern,
And the beadbonny ash that sits over the burn.

What would the world be, once bereft
Of wet and of wildness? Let them be left,
O let them be left, wildness and wet;
Long live the weeds and the wilderness yet.`,
  },
  {
    title: 'I wandered lonely as a Cloud',
    author: 'William Wordsworth',
    source: 'from Poems (1815)',
    kind: 'verse',
    text: `I wandered lonely as a Cloud
That floats on high o’er Vales and Hills,
When all at once I saw a crowd,
A host of golden Daffodils;
Beside the Lake, beneath the trees,
Fluttering and dancing in the breeze.

Continuous as the stars that shine
And twinkle on the milky way,
They stretched in never-ending line
Along the margin of a bay:
Ten thousand saw I at a glance,
Tossing their heads in sprightly dance.

The waves beside them danced, but they
Out-did the sparkling waves in glee:—
A Poet could not but be gay
In such a jocund company:
I gazed—and gazed—but little thought
What wealth the shew to me had brought:

For oft when on my couch I lie
In vacant or in pensive mood,
They flash upon that inward eye
Which is the bliss of solitude,
And then my heart with pleasure fills,
And dances with the Daffodils.`,
  },
  {
    title: 'To Autumn',
    author: 'John Keats',
    source: 'from Lamia, Isabella, The Eve of St. Agnes, and Other Poems (1820)',
    kind: 'verse',
    text: `Season of mists and mellow fruitfulness,
Close bosom-friend of the maturing sun;
Conspiring with him how to load and bless
With fruit the vines that round the thatch-eves run;
To bend with apples the moss’d cottage-trees,
And fill all fruit with ripeness to the core;
To swell the gourd, and plump the hazel shells
With a sweet kernel; to set budding more,
And still more, later flowers for the bees,
Until they think warm days will never cease,
For Summer has o’er-brimm’d their clammy cells.

Who hath not seen thee oft amid thy store?
Sometimes whoever seeks abroad may find
Thee sitting careless on a granary floor,
Thy hair soft-lifted by the winnowing wind;
Or on a half-reap’d furrow sound asleep,
Drows’d with the fume of poppies, while thy hook
Spares the next swath and all its twined flowers:
And sometimes like a gleaner thou dost keep
Steady thy laden head across a brook;
Or by a cyder-press, with patient look,
Thou watchest the last oozings hours by hours.

Where are the songs of Spring? Ay, where are they?
Think not of them, thou hast thy music too,—
While barred clouds bloom the soft-dying day,
And touch the stubble-plains with rosy hue;
Then in a wailful choir the small gnats mourn
Among the river sallows, borne aloft
Or sinking as the light wind lives or dies;
And full-grown lambs loud bleat from hilly bourn;
Hedge-crickets sing; and now with treble soft
The red-breast whistles from a garden-croft;
And gathering swallows twitter in the skies.`,
  },
  {
    title: 'The Tables Turned',
    author: 'William Wordsworth',
    source: 'an evening scene; from Poems (1815)',
    kind: 'verse',
    text: `Up! up! my Friend, and clear your looks;
Why all this toil and trouble?
Up! up! my Friend, and quit your books,
Or surely you’ll grow double.

The sun, above the mountain’s head,
A freshening lustre mellow
Through all the long green fields has spread,
His first sweet evening yellow.

Books! ’tis a dull and endless strife:
Come, hear the woodland Linnet,
How sweet his music! on my life
There’s more of wisdom in it.

And hark! how blithe the Throstle sings!
He, too, is no mean preacher:
Come forth into the light of things,
Let Nature be your teacher.

She has a world of ready wealth,
Our minds and hearts to bless—
Spontaneous wisdom breathed by health,
Truth breathed by cheerfulness.

One impulse from a vernal wood
May teach you more of man,
Of moral evil and of good,
Than all the sages can.

Sweet is the lore which Nature brings;
Our meddling intellect
Mis-shapes the beauteous forms of things;
—We murder to dissect.

Enough of Science and of Art;
Close up these barren leaves;
Come forth, and bring with you a heart
That watches and receives.`,
  },
];

/** The last page: where the texts come from. */
export const COLOPHON = [
  'Thoreau’s passage is from Walden as Project Gutenberg has it (ebook 205).',
  'The poems are as Wikisource has them from the editions named with each.',
  'All of them are in the public domain.',
];
