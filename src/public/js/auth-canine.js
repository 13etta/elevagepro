(() => {
  const visual = document.querySelector('.auth-canine-visual');
  if (!visual) return;

  const images = [
    'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&w=1600&q=82',
    'https://images.unsplash.com/photo-1558788353-f76d92427f16?auto=format&fit=crop&w=1600&q=82',
    'https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=1600&q=82',
    'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=1600&q=82',
    'https://images.unsplash.com/photo-1537151625747-768eb6cf92b2?auto=format&fit=crop&w=1600&q=82',
    'https://images.unsplash.com/photo-1507146426996-ef05306b995a?auto=format&fit=crop&w=1600&q=82',
    'https://images.unsplash.com/photo-1598133894008-61f7fdb8cc3a?auto=format&fit=crop&w=1600&q=82',
    'https://images.unsplash.com/photo-1576201836106-db1758fd1c97?auto=format&fit=crop&w=1600&q=82'
  ];

  const breedImages = {
    'Setter Anglais': 'https://images.unsplash.com/photo-1598133894008-61f7fdb8cc3a?auto=format&fit=crop&w=1600&q=82',
    'Pointer Anglais': 'https://images.unsplash.com/photo-1558788353-f76d92427f16?auto=format&fit=crop&w=1600&q=82',
    'Setter Gordon': 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=1600&q=82',
    'Golden Retriever': 'https://images.unsplash.com/photo-1633722715463-d30f4f325e24?auto=format&fit=crop&w=1600&q=82',
    'Labrador Retriever': 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&w=1600&q=82',
    'Berger Australien': 'https://images.unsplash.com/photo-1568572933382-74d440642117?auto=format&fit=crop&w=1600&q=82',
    'Border Collie': 'https://images.unsplash.com/photo-1507146426996-ef05306b995a?auto=format&fit=crop&w=1600&q=82'
  };

  const preload = (url) => {
    const img = new Image();
    img.src = url;
  };

  images.forEach(preload);
  Object.values(breedImages).forEach(preload);

  let currentIndex = Math.floor(Math.random() * images.length);
  let lockedByBreed = false;

  const setImage = (url) => {
    visual.classList.add('is-changing');
    window.setTimeout(() => {
      visual.style.setProperty('--auth-canine-bg', `url('${url}')`);
      window.setTimeout(() => visual.classList.remove('is-changing'), 220);
    }, 220);
  };

  setImage(images[currentIndex]);

  const breedSelect = document.querySelector('#primary_breed');
  if (breedSelect) {
    breedSelect.addEventListener('change', () => {
      const breed = breedSelect.value;
      if (breedImages[breed]) {
        lockedByBreed = true;
        setImage(breedImages[breed]);
      } else {
        lockedByBreed = false;
      }
    });
  }

  window.setInterval(() => {
    if (lockedByBreed) return;
    let nextIndex = currentIndex;
    while (nextIndex === currentIndex && images.length > 1) {
      nextIndex = Math.floor(Math.random() * images.length);
    }
    currentIndex = nextIndex;
    setImage(images[currentIndex]);
  }, 9000);
})();
