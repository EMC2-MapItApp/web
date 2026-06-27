import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CategoryBreadcrumb, LocationType, MainCategory, SubCategory } from '../models/category.model';

interface ApiLocationType {
  id: number;
  name: string;
  description: string;
}

interface ApiSubCategory {
  id: number;
  name: string;
  icon: string;
  locationTypes: ApiLocationType[];
}

interface ApiMainCategory {
  id: number;
  name: string;
  icon: string;
  color: string;
  subCategories: ApiSubCategory[];
}

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private readonly baseUrl = environment.apiCategoriesUrl;
  private treeCache: MainCategory[] = [];

  constructor(private http: HttpClient) {}

  getAll(): Observable<MainCategory[]> {
    return this.http.get<ApiMainCategory[]>(this.baseUrl + '/tree').pipe(
      map(api => this.mapTree(api)),
      tap(tree => {
        this.treeCache = tree;
      })
    );
  }

  getMainCategoryById(id: number): MainCategory | undefined {
    return this.treeCache.find(c => c.id === id);
  }

  getSubCategoryById(id: number): SubCategory | undefined {
    for (const main of this.treeCache) {
      const found = main.subcategories.find(s => s.id === id);
      if (found) return found;
    }
    return undefined;
  }

  getLocationTypeById(id: number): LocationType | undefined {
    for (const main of this.treeCache) {
      for (const sub of main.subcategories) {
        const found = sub.locationTypes.find(lt => lt.id === id);
        if (found) return found;
      }
    }
    return undefined;
  }

  resolveBreadcrumb(locationTypeId: number): CategoryBreadcrumb | undefined {
    for (const main of this.treeCache) {
      for (const sub of main.subcategories) {
        const lt = sub.locationTypes.find(t => t.id === locationTypeId);
        if (lt) {
          return { mainCategory: main, subCategory: sub, locationType: lt };
        }
      }
    }
    return undefined;
  }

  resolveColor(locationTypeId: number): string {
    const bc = this.resolveBreadcrumb(locationTypeId);
    return bc?.mainCategory.color ?? '#6b7280';
  }

  resolveIcon(locationTypeId: number): string {
    const bc = this.resolveBreadcrumb(locationTypeId);
    return bc?.subCategory.icon ?? '📍';
  }

  private mapTree(apiTree: ApiMainCategory[]): MainCategory[] {
    return apiTree.map(main => {
      const mainId = main.id;

      return {
        id: mainId,
        name: main.name,
        icon: main.icon,
        color: main.color,
        subcategories: main.subCategories.map(sub => {
          const subId = sub.id;

          return {
            id: subId,
            name: sub.name,
            icon: sub.icon,
            mainCategoryId: mainId,
            locationTypes: sub.locationTypes.map(lt => ({
              id: lt.id,
              name: lt.name,
              description: lt.description,
              subcategoryId: subId
            }))
          };
        })
      };
    });
  }
}