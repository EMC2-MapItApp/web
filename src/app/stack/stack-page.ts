/**
 * @file stack-page.ts
 * @description Página pública (sin login) que documenta el stack técnico y los servicios usados
 * en MapIt, con enlaces directos al código fuente en GitHub. Pensada tanto para reclutadores como
 * para agentes/IA que naveguen la app en vivo — ver también public/llms.txt.
 */
import { Component, inject, OnInit } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { STACK_GROUPS } from './stack-page.data';

@Component({
  selector: 'app-stack-page',
  standalone: true,
  imports: [RouterModule, MatIconModule],
  templateUrl: './stack-page.html',
  styleUrl: './stack-page.scss',
})
export class StackPageComponent implements OnInit {
  private readonly titleService = inject(Title);

  readonly groups = STACK_GROUPS;
  readonly backRepoUrl = 'https://github.com/EMC2-MapItApp/back';
  readonly webRepoUrl = 'https://github.com/EMC2-MapItApp/web';

  ngOnInit(): void {
    this.titleService.setTitle('MapIt — Stack técnico');
  }
}
