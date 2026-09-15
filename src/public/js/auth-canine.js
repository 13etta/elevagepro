(() => {
  const landing = document.querySelector('[data-login-landing]');
  if (landing) {
    const video = landing.querySelector('[data-login-video]');
    const videoToggle = landing.querySelector('[data-video-toggle]');
    const passwordToggle = landing.querySelector('[data-toggle-password]');

    video?.addEventListener('error', () => video.classList.add('is-hidden'));
    videoToggle?.addEventListener('click', () => {
      if (!video) return;
      const shouldPlay = video.paused;
      if (shouldPlay) video.play().catch(() => video.classList.add('is-hidden'));
      else video.pause();
      videoToggle.querySelector('.material-symbols-outlined').textContent = shouldPlay ? 'pause' : 'play_arrow';
      videoToggle.setAttribute('aria-label', shouldPlay ? 'Mettre la vidéo en pause' : 'Lire la vidéo');
    });
    passwordToggle?.addEventListener('click', () => {
      const input = document.getElementById(passwordToggle.dataset.togglePassword);
      if (!input) return;
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      passwordToggle.querySelector('.material-symbols-outlined').textContent = show ? 'visibility_off' : 'visibility';
      passwordToggle.setAttribute('aria-label', show ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
    });
  }

  const visual = document.querySelector('.auth-canine-visual');
  if (!visual) return;

  const images = [
    {
      url: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=1800&q=82',
      position: 'center center'
    },
    {
      url: 'https://images.unsplash.com/photo-1558788353-f76d92427f16?auto=format&fit=crop&w=1800&q=82',
      position: 'center 42%'
    },
    {
      url: 'https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=1800&q=82',
      position: 'center 45%'
    },
    {
      url: 'https://images.unsplash.com/photo-1507146426996-ef05306b995a?auto=format&fit=crop&w=1800&q=82',
      position: 'center 44%'
    },
    {
      url: 'https://images.unsplash.com/photo-1537151625747-768eb6cf92b2?auto=format&fit=crop&w=1800&q=82',
      position: 'center 46%'
    },
    {
      url: 'https://images.unsplash.com/photo-1576201836106-db1758fd1c97?auto=format&fit=crop&w=1800&q=82',
      position: 'center 48%'
    }
  ];

  const breedImages = {
    'Setter Anglais': {
      url: 'https://images.unsplash.com/photo-1558788353-f76d92427f16?auto=format&fit=crop&w=1800&q=82',
      position: 'center 42%'
    },
    'Pointer Anglais': {
      url: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=1800&q=82',
      position: 'center center'
    },
    'Setter Gordon': {
      url: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=1800&q=82',
      position: 'center center'
    },
    'Golden Retriever': {
      url: 'https://images.unsplash.com/photo-1558788353-f76d92427f16?auto=format&fit=crop&w=1800&q=82',
      position: 'center 42%'
    },
    'Labrador Retriever': {
      url: 'https://images.unsplash.com/photo-1537151625747-768eb6cf92b2?auto=format&fit=crop&w=1800&q=82',
      position: 'center 46%'
    },
    'Berger Australien': {
      url: 'https://images.unsplash.com/photo-1507146426996-ef05306b995a?auto=format&fit=crop&w=1800&q=82',
      position: 'center 44%'
    },
    'Border Collie': {
      url: 'https://images.unsplash.com/photo-1576201836106-db1758fd1c97?auto=format&fit=crop&w=1800&q=82',
      position: 'center 48%'
    }
  };

  const preload = (item) => {
    const img = new Image();
    img.src = item.url;
  };

  images.forEach(preload);
  Object.values(breedImages).forEach(preload);

  let currentIndex = Math.floor(Math.random() * images.length);
  let lockedByBreed = false;

  const setImage = (item) => {
    visual.classList.add('is-changing');
    window.setTimeout(() => {
      visual.style.setProperty('--auth-canine-bg', `url('${item.url}')`);
      visual.style.setProperty('--auth-canine-position', item.position || 'center center');
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

