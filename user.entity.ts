import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    ManyToMany,
    OneToMany,
    OneToOne,
    JoinTable,
    Index
} from 'typeorm'
import { Group } from '../group/group.entity'
import { Note } from '../notes/note.entity'
import { Restriction } from '../restrictions/restriction.entity'


@Entity()
export class User {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column()
    name: string;

    @Column()
    password: string;

    @Index()
    @Column()
    email: string;

    @Column({
        default: 'USER'
    })
    role: string;

    @OneToOne((type => Restriction), (restriction) => restriction.user, {
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
        cascade: true,
    })
    restriction: Restriction;

    @ManyToMany((type) => Group)
    @JoinTable({
        joinColumn: {
            name: "group",
            referencedColumnName: "id"
        },
        inverseJoinColumn: {
            name: "user",
            referencedColumnName: "id"
        }
    })
    groups: Group[];

    @OneToMany((type) => Group, (group) => group.author, {
        cascade: true,
        onDelete: "CASCADE"
    })
    myGroups: Group[];

    @OneToMany((type) => Note, (note) => note.user, {
        cascade: true,
        onDelete: 'CASCADE',
    })
    notes: Note[];

    @OneToMany((type) => Note, (note) => note.author, {
        cascade: true,
        onDelete: "CASCADE"
    })
    myNotes: Group[];
}
