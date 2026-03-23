export default defineAppConfig({
  title: 'ClipMafia',
  description: 'Turn your videos into viral Shorts in 1 click',
  plans: {
    free: {
      name: 'Free',
      price: 0,
      videosPerMonth: 3,
      features: ['3 videos/month', 'Auto subtitles', 'Center crop'],
    },
    basic: {
      name: 'Basic',
      price: 19,
      videosPerMonth: 20,
      features: ['20 videos/month', 'Auto subtitles', 'Smart framing', 'Priority processing'],
    },
    pro: {
      name: 'Pro',
      price: 49,
      videosPerMonth: 100,
      features: ['100 videos/month', 'Auto subtitles', 'Smart framing', 'Priority processing', 'API access'],
    },
  },
})
