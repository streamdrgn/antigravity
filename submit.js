/**
 * submit.js
 * 퀴즈 렌더링, 폼 유효성 검사, 답안 제출 및 채점, 결과 화면 생성 로직
 */

(function () {
  'use strict';

  // --- Web Audio API 사운드 생성기 (외부 파일 없이 동작) ---
  class SoundEffects {
    constructor() {
      this.ctx = null;
      this.enabled = true;
    }

    init() {
      if (!this.ctx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          this.ctx = new AudioContext();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    playClick() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.08);
    }

    playFanfare() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const now = this.ctx.currentTime + (idx * 0.12);
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.6);
      });
    }
  }

  const sfx = new SoundEffects();

  // --- Confetti 폭죽 효과 클래스 ---
  class ConfettiEffect {
    constructor(canvasId) {
      this.canvas = document.getElementById(canvasId);
      if (!this.canvas) return;
      this.ctx = this.canvas.getContext('2d');
      this.particles = [];
      this.animId = null;
      this.resize();
      window.addEventListener('resize', () => this.resize());
    }

    resize() {
      if (!this.canvas) return;
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    }

    start(durationMs = 3500) {
      if (!this.canvas || !this.ctx) return;
      this.particles = [];
      const colors = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];
      const count = 120;

      for (let i = 0; i < count; i++) {
        this.particles.push({
          x: Math.random() * this.canvas.width,
          y: Math.random() * this.canvas.height * 0.3 - 50,
          w: Math.random() * 8 + 6,
          h: Math.random() * 6 + 4,
          vx: (Math.random() - 0.5) * 4,
          vy: Math.random() * 3 + 2.5,
          rot: Math.random() * 360,
          vRot: (Math.random() - 0.5) * 8,
          color: colors[Math.floor(Math.random() * colors.length)],
          opacity: 1
        });
      }

      const startTime = Date.now();
      const animate = () => {
        const elapsed = Date.now() - startTime;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.particles.forEach(p => {
          p.x += p.vx;
          p.y += p.vy;
          p.rot += p.vRot;
          if (elapsed > durationMs - 1000) {
            p.opacity = Math.max(0, 1 - (elapsed - (durationMs - 1000)) / 1000);
          }

          this.ctx.save();
          this.ctx.translate(p.x, p.y);
          this.ctx.rotate((p.rot * Math.PI) / 180);
          this.ctx.globalAlpha = p.opacity;
          this.ctx.fillStyle = p.color;
          this.ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          this.ctx.restore();
        });

        if (elapsed < durationMs) {
          this.animId = requestAnimationFrame(animate);
        } else {
          this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
      };
      cancelAnimationFrame(this.animId);
      animate();
    }
  }

  let confetti;

  // --- DOM 로드 후 초기화 ---
  document.addEventListener('DOMContentLoaded', () => {
    confetti = new ConfettiEffect('confetti-canvas');
    initThemeAndSound();
    renderQuestionsList();
    initFormProgress();
    initSubmitHandler();
    initResultActions();
  });

  // --- 테마 및 사운드 토글 초기화 ---
  function initThemeAndSound() {
    const soundBtn = document.getElementById('sound-btn');
    const themeBtn = document.getElementById('theme-btn');

    if (soundBtn) {
      soundBtn.addEventListener('click', () => {
        sfx.enabled = !sfx.enabled;
        soundBtn.textContent = sfx.enabled ? '🔊' : '🔇';
        soundBtn.title = sfx.enabled ? '소리 끄기' : '소리 켜기';
      });
    }

    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const isDark = document.body.getAttribute('data-theme') === 'dark';
        if (isDark) {
          document.body.removeAttribute('data-theme');
          themeBtn.textContent = '🌙';
          themeBtn.title = '다크 모드로 전환';
        } else {
          document.body.setAttribute('data-theme', 'dark');
          themeBtn.textContent = '☀️';
          themeBtn.title = '라이트 모드로 전환';
        }
      });
    }
  }

  // --- 문제 목록 동적 렌더링 ---
  function renderQuestionsList() {
    const container = document.getElementById('questions-container');
    if (!container) return;

    const questions = window.quizQuestions || [];
    container.innerHTML = '';

    const optionLabels = ['A', 'B', 'C', 'D'];

    questions.forEach((q, qIdx) => {
      const qNum = qIdx + 1;
      const card = document.createElement('div');
      card.className = 'question-card';
      card.id = `q-card-${qNum}`;

      // 카테고리 태그 + 문제 번호
      const meta = document.createElement('div');
      meta.className = 'q-meta';
      meta.innerHTML = `
        <span class="q-category-tag">${q.categoryEmoji} ${q.category}</span>
        <span class="q-number">문제 ${qNum} / ${questions.length}</span>
      `;
      card.appendChild(meta);

      // 상황 시나리오 박스 (있을 경우)
      if (q.scenario) {
        const scenarioEl = document.createElement('div');
        scenarioEl.className = 'q-scenario';
        scenarioEl.innerHTML = `<strong>상황 예시:</strong> ${q.scenario}`;
        card.appendChild(scenarioEl);
      }

      // 문제 제목
      const title = document.createElement('h3');
      title.className = 'q-title';
      title.textContent = q.question;
      card.appendChild(title);

      // 선택지 라디오 그룹
      const optionsGroup = document.createElement('div');
      optionsGroup.className = 'options-group';

      q.options.forEach((optText, optIdx) => {
        const label = document.createElement('label');
        label.className = 'option-item';
        label.setAttribute('for', `q${qNum}_opt${optIdx}`);

        const input = document.createElement('input');
        input.type = 'radio';
        input.name = `question_${qNum}`;
        input.id = `q${qNum}_opt${optIdx}`;
        input.value = optIdx;
        input.required = true;

        input.addEventListener('change', () => {
          sfx.playClick();
          updateCardSelection(card);
          updateAnsweredCount();
        });

        label.appendChild(input);

        const badge = document.createElement('span');
        badge.className = 'opt-badge';
        badge.textContent = optionLabels[optIdx];
        label.appendChild(badge);

        const textSpan = document.createElement('span');
        textSpan.className = 'opt-text';
        textSpan.textContent = optText;
        label.appendChild(textSpan);

        optionsGroup.appendChild(label);
      });

      card.appendChild(optionsGroup);
      container.appendChild(card);
    });

    updateAnsweredCount();
  }

  // --- 선택된 카드 비주얼 하이라이트 ---
  function updateCardSelection(card) {
    card.classList.remove('has-error');
    const checkedOption = card.querySelector('input[type="radio"]:checked');
    if (checkedOption) {
      card.classList.add('answered');
    }
  }

  // --- 진행률 바 & 완료 카운트 업데이트 ---
  function updateAnsweredCount() {
    const questions = window.quizQuestions || [];
    const total = questions.length;
    let answered = 0;

    for (let i = 1; i <= total; i++) {
      if (document.querySelector(`input[name="question_${i}"]:checked`)) {
        answered++;
      }
    }

    const progressFill = document.getElementById('progress-bar-fill');
    const progressCountText = document.getElementById('progress-count-text');

    if (progressFill) {
      const pct = (answered / total) * 100;
      progressFill.style.width = `${pct}%`;
    }
    if (progressCountText) {
      progressCountText.textContent = `${answered} / ${total}`;
    }
  }

  // --- 폼 진행 모니터링 ---
  function initFormProgress() {
    const nicknameInput = document.getElementById('user-nickname');
    if (nicknameInput) {
      nicknameInput.addEventListener('input', () => {
        const val = nicknameInput.value.trim();
        sessionStorage.setItem('quiz_user_name', val);
      });
    }
  }

  // --- 폼 제출 및 유효성 검사, 채점 핸들러 ---
  function initSubmitHandler() {
    const form = document.getElementById('quiz-form');
    if (!form) return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      handleQuizSubmission();
    });
  }

  function handleQuizSubmission() {
    const questions = window.quizQuestions || [];
    const total = questions.length;
    let firstUnansweredNum = null;
    const userAnswers = [];

    // 유효성 검사: 모든 문항 선택 확인
    for (let i = 1; i <= total; i++) {
      const selected = document.querySelector(`input[name="question_${i}"]:checked`);
      const card = document.getElementById(`q-card-${i}`);

      if (!selected) {
        if (!firstUnansweredNum) {
          firstUnansweredNum = i;
        }
        if (card) {
          card.classList.add('has-error');
        }
      } else {
        if (card) {
          card.classList.remove('has-error');
        }
        userAnswers.push({
          questionId: questions[i - 1].id,
          selectedIdx: parseInt(selected.value, 10),
          correctIdx: questions[i - 1].correct,
          isCorrect: parseInt(selected.value, 10) === questions[i - 1].correct
        });
      }
    }

    // 미응답 문항이 있으면 해당 위치로 부드럽게 스크롤 이동
    if (firstUnansweredNum !== null) {
      const targetCard = document.getElementById(`q-card-${firstUnansweredNum}`);
      if (targetCard) {
        targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        targetCard.classList.add('shake');
        setTimeout(() => targetCard.classList.remove('shake'), 600);
      }
      showToast(`⚠️ 문제 ${firstUnansweredNum}번의 답안을 선택해 주세요!`);
      return;
    }

    // 모든 문항 완료 -> 채점 실행
    evaluateAndDisplayResults(userAnswers);
  }

  // --- 간단한 토스트 알림 메시지 ---
  function showToast(message) {
    let toast = document.getElementById('quiz-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'quiz-toast';
      toast.className = 'quiz-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('visible');
    setTimeout(() => {
      toast.classList.remove('visible');
    }, 2800);
  }

  // --- 채점 및 결과 화면 표시 ---
  function evaluateAndDisplayResults(userAnswers) {
    const questions = window.quizQuestions || [];
    const nicknameInput = document.getElementById('user-nickname');
    const userName = (nicknameInput && nicknameInput.value.trim().length > 0)
      ? nicknameInput.value.trim()
      : '멋진 디지털 시민';

    let correctCount = 0;
    userAnswers.forEach(ans => {
      if (ans.isCorrect) correctCount++;
    });

    const score = correctCount * 10; // 문항당 10점

    // 화면 전환 (폼 숨기고 결과 섹션 표시)
    const formSection = document.getElementById('quiz-form-section');
    const resultSection = document.getElementById('result-section');

    if (formSection) formSection.style.display = 'none';
    if (resultSection) {
      resultSection.style.display = 'block';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // 팡파르 및 폭죽
    sfx.playFanfare();
    if (confetti) confetti.start(4500);

    // 텍스트 업데이트
    document.getElementById('res-user-name').textContent = userName;
    document.getElementById('res-score-number').textContent = score;
    document.getElementById('res-correct-count').textContent = correctCount;

    // 등급 판정
    let gradeTitle = "";
    let gradeBadge = "";
    let gradeIcon = "🏆";
    let sealText = "공식 디지털 안심 시민";

    if (score >= 90) {
      gradeTitle = "마스터 디지털 시민 (Master Citizen)";
      gradeBadge = "최우수 마스터 등급";
      gradeIcon = "🌟";
      sealText = "최우수 마스터 시민 등급";
    } else if (score >= 70) {
      gradeTitle = "스마트 디지털 가디언 (Smart Guardian)";
      gradeBadge = "우수 가디언 등급";
      gradeIcon = "🛡️";
      sealText = "우수 디지털 가디언 등급";
    } else if (score >= 50) {
      gradeTitle = "새싹 디지털 탐험가 (Growing Explorer)";
      gradeBadge = "성장 탐험가 등급";
      gradeIcon = "🌱";
      sealText = "성장 디지털 시민 등급";
    } else {
      gradeTitle = "디지털 안전 수습생 (Safety Apprentice)";
      gradeBadge = "안전 주의 수습생 등급";
      gradeIcon = "🧭";
      sealText = "안전 수습생 등급";
    }

    document.getElementById('res-badge-icon').textContent = gradeIcon;
    document.getElementById('res-grade-title').textContent = gradeTitle;
    document.getElementById('res-grade-badge').textContent = gradeBadge;

    // 인증서 정보 채우기
    document.getElementById('cert-name').textContent = userName;
    const now = new Date();
    document.getElementById('cert-date').textContent = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일`;
    document.getElementById('cert-seal-text').textContent = sealText;

    // 영역별 분석 채우기
    renderCategoryAnalysis(userAnswers);

    // 상세 오답 노트 및 전체 해설 렌더링
    renderReviewNotes(userAnswers);
  }

  // --- 영역별 정답 분석표 렌더링 ---
  function renderCategoryAnalysis(userAnswers) {
    const listEl = document.getElementById('analysis-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    const questions = window.quizQuestions || [];
    questions.forEach((q, idx) => {
      const ans = userAnswers[idx];
      const isOk = ans && ans.isCorrect;

      const row = document.createElement('div');
      row.className = 'analysis-row';
      row.innerHTML = `
        <span class="analysis-category">${q.categoryEmoji} ${q.category}</span>
        <span class="analysis-badge ${isOk ? 'badge-pass' : 'badge-warn'}">
          ${isOk ? '✓ 정답 통과 (10점)' : '⚠️ 복습 필요 (0점)'}
        </span>
      `;
      listEl.appendChild(row);
    });
  }

  // --- 오답 노트 및 전체 해설 렌더링 ---
  function renderReviewNotes(userAnswers) {
    const container = document.getElementById('review-notes-container');
    if (!container) return;
    container.innerHTML = '';

    const questions = window.quizQuestions || [];
    const optionLabels = ['A', 'B', 'C', 'D'];

    questions.forEach((q, idx) => {
      const qNum = idx + 1;
      const ans = userAnswers[idx];
      const isOk = ans && ans.isCorrect;

      const card = document.createElement('div');
      card.className = `review-note-card ${isOk ? 'note-correct' : 'note-wrong'}`;

      const header = document.createElement('div');
      header.className = 'review-note-header';
      header.innerHTML = `
        <span class="review-status-tag ${isOk ? 'tag-green' : 'tag-red'}">
          ${isOk ? '✓ 문제 ' + qNum + ' 정답' : '✕ 문제 ' + qNum + ' 오답'}
        </span>
        <span class="review-category-tag">${q.categoryEmoji} ${q.category}</span>
      `;
      card.appendChild(header);

      const qText = document.createElement('div');
      qText.className = 'review-note-title';
      qText.textContent = q.question;
      card.appendChild(qText);

      // 내가 선택한 답 vs 정답
      const ansCompare = document.createElement('div');
      ansCompare.className = 'review-compare-box';

      const userChoiceText = ans ? `${optionLabels[ans.selectedIdx]}. ${q.options[ans.selectedIdx]}` : '미선택';
      const correctChoiceText = `${optionLabels[q.correct]}. ${q.options[q.correct]}`;

      ansCompare.innerHTML = `
        <div class="compare-item ${isOk ? 'compare-ok' : 'compare-wrong'}">
          <strong>내가 고른 답:</strong> ${userChoiceText}
        </div>
        ${!isOk ? `
          <div class="compare-item compare-correct">
            <strong>정답 확인:</strong> ${correctChoiceText}
          </div>
        ` : ''}
      `;
      card.appendChild(ansCompare);

      // 해설 박스
      const expBox = document.createElement('div');
      expBox.className = 'review-explanation';
      expBox.innerHTML = `<strong>💡 핵심 가이드:</strong> ${q.explanation}`;
      card.appendChild(expBox);

      container.appendChild(card);
    });
  }

  // --- 결과 화면 버튼 (다시 풀기 / 인쇄) ---
  function initResultActions() {
    const retryBtn = document.getElementById('retry-btn');
    const printBtn = document.getElementById('print-btn');

    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        // 폼 초기화
        const form = document.getElementById('quiz-form');
        if (form) form.reset();

        document.querySelectorAll('.question-card').forEach(c => {
          c.classList.remove('answered', 'has-error');
        });

        updateAnsweredCount();

        // 뷰 전환
        const formSection = document.getElementById('quiz-form-section');
        const resultSection = document.getElementById('result-section');
        if (resultSection) resultSection.style.display = 'none';
        if (formSection) {
          formSection.style.display = 'block';
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    }

    if (printBtn) {
      printBtn.addEventListener('click', () => {
        window.print();
      });
    }
  }

})();
