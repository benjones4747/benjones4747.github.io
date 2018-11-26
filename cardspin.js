const machine = {
  initial: 1,
  states: {
    1: {
      on: {
        NEXT: 2
      }
    },
    2: {
      on: {
        NEXT: 3
      }
    },
    3: {
      on: {
        NEXT: 4
      }
    },
    4: {
      on: {
        NEXT: 1
      }
    }
  }
};

const elApp = document.querySelector('#app');
elApp.addEventListener('click', ()=>{
  send('NEXT');
});

let current = elApp.dataset.state = machine.initial;

function transition(state, event) {
  return machine
    .states[state]
    .on[event] || state;
}

function activate(state) {

  elApp.dataset.state = state;

  [...document.querySelectorAll("[data-active]")]
    .forEach(el => {
    el.removeAttribute("data-active");
  });

  [...document.querySelectorAll(`[data-show~="${state}"]`)]
    .forEach(el => {
    el.setAttribute("data-active", true);
  });
}

function send(event){
  current = transition(current, event);

  console.log(current);

  activate(current);
}

activate(current);
