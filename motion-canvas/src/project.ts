import {makeProject} from '@motion-canvas/core';
import scene1_genesis from './scenes/scene1_genesis?scene';
import scene2_frontier_matrix from './scenes/scene2_frontier_matrix?scene';
import scene3_prompt_compiler from './scenes/scene3_prompt_compiler?scene';
import scene4_dag_branching from './scenes/scene4_dag_branching?scene';
import scene5_arena_frameworks from './scenes/scene5_arena_frameworks?scene';
import scene6_monolith_finale from './scenes/scene6_monolith_finale?scene';

export default makeProject({
  scenes: [
    scene1_genesis,
    scene2_frontier_matrix,
    scene3_prompt_compiler,
    scene4_dag_branching,
    scene5_arena_frameworks,
    scene6_monolith_finale,
  ],
});
