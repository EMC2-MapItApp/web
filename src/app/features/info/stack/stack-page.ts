/**
 * @file stack-page.ts
 * @description Página que documenta el stack técnico y los servicios usados en MapIt, con
 * enlaces directos al código fuente en GitHub. Pensada tanto para reclutadores como para
 * agentes/IA que naveguen la app en vivo — ver también public/llms.txt. Se renderiza dentro
 * del shell de home (ruta hija sin guard de login) para compartir el mismo marco visual que
 * el resto de páginas de la app (Ajustes, Perfil).
 */
import { Component, inject, OnInit } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { STACK_GROUPS } from './stack-page.data';

@Component({
  selector: 'app-stack-page',
  standalone: true,
  imports: [MatIconModule, MatExpansionModule],
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
